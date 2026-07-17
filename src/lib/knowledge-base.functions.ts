import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const EMBED_DIMS = 768; // must match vector(768) column
// Preferred embedding models, newest first. First one available on the key is used.
const PREFERRED_EMBED_MODELS = [
  "gemini-embedding-001",
  "text-embedding-004",
  "embedding-001",
];
const API_BASE = "https://generativelanguage.googleapis.com/v1beta";

const CHUNK_SIZE = 2000; // ~500 tokens
const CHUNK_OVERLAP = 200;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["text/plain", "text/markdown"];

function chunkText(text: string): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(i + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(i, end));
    if (end === clean.length) break;
    i = end - CHUNK_OVERLAP;
  }
  return chunks;
}

let cachedModel: string | null = null;

async function resolveEmbedModel(apiKey: string): Promise<string> {
  if (cachedModel) return cachedModel;
  try {
    const res = await fetch(`${API_BASE}/models?key=${apiKey}&pageSize=200`);
    if (res.ok) {
      const json = (await res.json()) as {
        models?: { name?: string; supportedGenerationMethods?: string[] }[];
      };
      const embedders = (json.models ?? [])
        .filter((m) => (m.supportedGenerationMethods ?? []).includes("embedContent"))
        .map((m) => (m.name ?? "").replace(/^models\//, ""))
        .filter(Boolean);
      for (const pref of PREFERRED_EMBED_MODELS) {
        if (embedders.includes(pref)) {
          cachedModel = pref;
          return pref;
        }
      }
      // Fallback: first available embedder
      if (embedders.length > 0) {
        cachedModel = embedders[0];
        return embedders[0];
      }
    } else {
      console.error("[knowledge-base] ListModels failed", res.status, (await res.text()).slice(0, 200));
    }
  } catch (e) {
    console.error("[knowledge-base] ListModels error", e instanceof Error ? e.message : e);
  }
  // Last-resort default
  cachedModel = PREFERRED_EMBED_MODELS[0];
  return cachedModel;
}

async function embed(text: string, apiKey: string, model: string): Promise<number[]> {
  const url = `${API_BASE}/models/${model}:embedContent?key=${apiKey}`;
  const body: Record<string, unknown> = {
    content: { parts: [{ text }] },
  };
  // gemini-embedding-001 supports outputDimensionality to match our 768-dim column.
  if (model.startsWith("gemini-embedding")) {
    body.outputDimensionality = EMBED_DIMS;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 500);
    console.error(`[knowledge-base] embed ${res.status} model=${model}: ${errText}`);
    throw new Error(`Gemini embed failed (${res.status}) using ${model}: ${errText}`);
  }
  const json = (await res.json()) as { embedding?: { values?: number[] } };
  const values = json.embedding?.values;
  if (!values || values.length === 0) throw new Error("Gemini returned empty embedding");
  if (values.length !== EMBED_DIMS) {
    throw new Error(
      `Embedding dim mismatch: got ${values.length}, expected ${EMBED_DIMS} (model=${model})`,
    );
  }
  return values;
}

// Create a document row after client uploads file to storage.
export const createKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        fileName: z.string().min(1).max(300),
        fileType: z.string().min(1).max(100),
        filePath: z.string().min(1).max(500),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED_TYPES.includes(data.fileType) && !/\.(txt|md|markdown)$/i.test(data.fileName)) {
      throw new Error("Only TXT and Markdown files are supported");
    }
    const { data: row, error } = await context.supabase
      .from("knowledge_documents")
      .insert({
        title: data.title,
        file_name: data.fileName,
        file_type: data.fileType,
        file_url: data.filePath,
        processing_status: "uploaded",
        total_chunks: 0,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const processKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const apiKey = process.env.Gemini_api;
    if (!apiKey) throw new Error("Server misconfigured: missing Gemini API key");

    // Fetch doc (RLS ensures ownership)
    const { data: doc, error: docErr } = await context.supabase
      .from("knowledge_documents")
      .select("id, file_url, processing_status")
      .eq("id", data.documentId)
      .single();
    if (docErr || !doc) throw new Error("Document not found");

    // Prevent duplicate processing
    if (doc.processing_status === "processing" || doc.processing_status === "ready") {
      return { status: doc.processing_status, chunks: 0 };
    }

    // Mark processing
    await context.supabase
      .from("knowledge_documents")
      .update({ processing_status: "processing", error_message: null })
      .eq("id", doc.id);

    try {
      // Download file (user-scoped via RLS)
      const { data: blob, error: dlErr } = await context.supabase.storage
        .from("knowledge-base")
        .download(doc.file_url);
      if (dlErr || !blob) throw new Error(`Download failed: ${dlErr?.message ?? "unknown"}`);
      const text = await blob.text();
      if (!text.trim()) throw new Error("File is empty");

      const chunks = chunkText(text);
      if (chunks.length === 0) throw new Error("No chunks produced");

      const model = await resolveEmbedModel(apiKey);

      // Embed sequentially to respect rate limits
      const rows: {
        document_id: string;
        chunk_text: string;
        chunk_index: number;
        embedding: string;
      }[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const values = await embed(chunks[i], apiKey, model);
        rows.push({
          document_id: doc.id,
          chunk_text: chunks[i],
          chunk_index: i,
          // pgvector accepts string form "[v1,v2,...]"
          embedding: `[${values.join(",")}]`,
        });
      }

      const { error: insErr } = await context.supabase.from("knowledge_chunks").insert(rows);
      if (insErr) throw new Error(`Insert chunks failed: ${insErr.message}`);

      await context.supabase
        .from("knowledge_documents")
        .update({ processing_status: "ready", total_chunks: rows.length })
        .eq("id", doc.id);

      return { status: "ready" as const, chunks: rows.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[knowledge-base] processing failed", message);
      await context.supabase
        .from("knowledge_documents")
        .update({ processing_status: "failed", error_message: message.slice(0, 500) })
        .eq("id", doc.id);
      // Cleanup any partial chunks
      await context.supabase.from("knowledge_chunks").delete().eq("document_id", doc.id);
      throw new Error(message);
    }
  });

export const listKnowledgeDocuments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("knowledge_documents")
      .select("id, title, file_name, file_type, processing_status, total_chunks, error_message, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getKnowledgeDocumentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("knowledge_documents")
      .select("id, processing_status, total_chunks, error_message")
      .eq("id", data.documentId)
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteKnowledgeDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ documentId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: doc, error: fetchErr } = await context.supabase
      .from("knowledge_documents")
      .select("id, file_url")
      .eq("id", data.documentId)
      .single();
    if (fetchErr || !doc) throw new Error("Document not found");

    // Best-effort file removal
    await context.supabase.storage.from("knowledge-base").remove([doc.file_url]);

    const { error: delErr } = await context.supabase
      .from("knowledge_documents")
      .delete()
      .eq("id", doc.id);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });

export const KNOWLEDGE_BASE_CONFIG = {
  maxFileBytes: MAX_FILE_BYTES,
  allowedExtensions: [".txt", ".md", ".markdown"],
};
