import { createFileRoute } from "@tanstack/react-router";
import {
  convertToModelMessages,
  streamText,
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

// ---- Config ---------------------------------------------------------------
const GEMINI_MODEL = "gemini-2.5-flash";
const EMBED_MODEL = "gemini-embedding-001"; // MUST match KB ingestion
const EMBED_DIMS = 768;
const MAX_CHUNKS = 5;
const MIN_SIMILARITY = 0.55;
const DEDUP_JACCARD = 0.85;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";

const NO_KB_MATCH_FALLBACK =
  "I could not find enough information about this in the ZuZo AI Knowledge Base. Please consult a licensed veterinarian for personalised advice regarding your pet.";
const OUT_OF_SCOPE_FALLBACK =
  "This question is outside the ZuZo AI Knowledge Base. ZuZo AI provides educational guidance about pet health, nutrition, grooming, vaccinations, behaviour, preventive care and general pet wellness.";
const EDU_DISCLAIMER =
  "This information is for educational purposes only and does not replace professional veterinary care.";

const SYSTEM_PROMPT = `You are ZuZo AI 🐾, an AI-powered Pet Care Assistant.

RULES (non-negotiable):
- Answer PRIMARILY from the supplied KNOWLEDGE BASE CONTEXT.
- Never invent facts or answer from your own general knowledge when the KB is insufficient.
- Never diagnose diseases with certainty. Never prescribe medicines or dosages.
- Always recommend consulting a licensed veterinarian for serious/urgent issues.
- Use calm, supportive, simple language for pet owners.
- If the KB context is insufficient, reply EXACTLY: "${NO_KB_MATCH_FALLBACK}"
- If the question is unrelated to pet care, reply EXACTLY: "${OUT_OF_SCOPE_FALLBACK}"
- End every grounded answer with a blank line then: "${EDU_DISCLAIMER}"`;

// Emergency detection
const EMERGENCY_PATTERNS: RegExp[] = [
  /difficulty breathing|can(?:no|')?t breathe|trouble breathing|not breathing/i,
  /seizure|convulsion/i,
  /collapse|collapsed|unconscious|unresponsive/i,
  /poison|toxic|ingested|ate .*(chocolate|xylitol|grape|raisin|onion|garlic|rat poison|antifreeze)/i,
  /chocolate ingestion|xylitol/i,
  /heatstroke|overheated|heat stroke/i,
  /persistent vomiting|keeps vomiting|vomiting blood/i,
  /bloody (?:diarrhea|diarrhoea|stool)/i,
  /severe bleeding|won'?t stop bleeding|hemorrhage|haemorrhage/i,
  /cannot urinate|can'?t (?:pee|urinate)|blocked bladder/i,
  /severe trauma|hit by (?:a )?(?:car|vehicle)/i,
  /snake bite|snakebite/i,
  /severe allergic reaction|anaphylaxis|swollen (?:face|throat)/i,
  /choking/i,
];

function isEmergency(text: string): boolean {
  return EMERGENCY_PATTERNS.some((r) => r.test(text));
}

// ---- Helpers --------------------------------------------------------------

function extractUserText(msg: UIMessage | undefined): string {
  if (!msg || msg.role !== "user") return "";
  return msg.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("")
    .trim();
}

async function embedQuery(text: string, apiKey: string): Promise<number[] | null> {
  try {
    const url = `${GEMINI_BASE}/models/${EMBED_MODEL}:embedContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: { parts: [{ text }] },
        outputDimensionality: EMBED_DIMS,
      }),
    });
    if (!res.ok) {
      console.error("[rag] embed failed", res.status, (await res.text()).slice(0, 300));
      return null;
    }
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    return json.embedding?.values ?? null;
  } catch (e) {
    console.error("[rag] embed error", e instanceof Error ? e.message : e);
    return null;
  }
}

type Chunk = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
};

function jaccard(a: string, b: string): number {
  const sa = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const sb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  sa.forEach((w) => sb.has(w) && inter++);
  return inter / (sa.size + sb.size - inter);
}

function dedupe(chunks: Chunk[]): Chunk[] {
  const kept: Chunk[] = [];
  for (const c of chunks) {
    if (kept.some((k) => jaccard(k.chunk_text, c.chunk_text) >= DEDUP_JACCARD)) continue;
    kept.push(c);
  }
  return kept;
}

function buildContextBlock(chunks: Chunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `Source ${i + 1}\nDocument title: ${c.document_title}\nSection: chunk #${c.chunk_index + 1}\nContent:\n${c.chunk_text}`,
    )
    .join("\n\n---\n\n");
}

function staticStreamResponse(
  text: string,
  originalMessages: UIMessage[],
  persist: (finalText: string) => Promise<void>,
) {
  const stream = createUIMessageStream({
    originalMessages,
    execute: ({ writer }) => {
      const id = crypto.randomUUID();
      writer.write({ type: "text-start", id });
      writer.write({ type: "text-delta", id, delta: text });
      writer.write({ type: "text-end", id });
    },
    onFinish: async () => {
      await persist(text);
    },
  });
  return createUIMessageStreamResponse({ stream });
}

// ---- Route ----------------------------------------------------------------

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Auth
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });
        const userId = userData.user.id;

        // 2. Parse + validate
        const body = (await request.json()) as { messages?: UIMessage[]; sessionId?: string };
        const messages = body.messages ?? [];
        const sessionId = body.sessionId;
        if (!sessionId) return new Response("Missing sessionId", { status: 400 });

        const last = messages[messages.length - 1];
        const userQuestion = extractUserText(last).slice(0, 2000);
        if (!userQuestion) return new Response("Empty question", { status: 400 });

        const geminiKey = process.env.Gemini_api;
        if (!geminiKey) return new Response("Server misconfigured", { status: 500 });

        // Persist user message
        await supabase.from("chat_messages").insert({
          user_id: userId,
          session_id: sessionId,
          role: "user",
          content: userQuestion,
        });

        const persistAssistant = async (finalText: string) => {
          const text = finalText.trim();
          if (!text) return;
          await supabase.from("chat_messages").insert({
            user_id: userId,
            session_id: sessionId,
            role: "assistant",
            content: text,
          });
        };

        // 3. Emergency short-circuit (before retrieval)
        if (isEmergency(userQuestion)) {
          const emergencyText = [
            "⚠️ This sounds like a possible emergency.",
            "",
            "Please contact your veterinarian or the nearest emergency animal hospital IMMEDIATELY. Do not attempt home treatment.",
            "",
            "While traveling: keep your pet calm, warm, and still. Bring any suspected toxin container or a sample if poisoning is possible.",
            "",
            EDU_DISCLAIMER,
          ].join("\n");
          return staticStreamResponse(emergencyText, messages, persistAssistant);
        }

        // 4-9. Embed + retrieve + filter + dedupe
        const embedding = await embedQuery(userQuestion, geminiKey);
        let chunks: Chunk[] = [];
        if (embedding && embedding.length === EMBED_DIMS) {
          const { data: matches, error: matchErr } = await supabase.rpc(
            "match_knowledge_chunks" as never,
            {
              query_embedding: `[${embedding.join(",")}]` as unknown as never,
              match_count: MAX_CHUNKS,
              min_similarity: MIN_SIMILARITY,
            } as never,
          );
          if (matchErr) {
            console.error("[rag] match_knowledge_chunks error", matchErr.message);
          } else if (Array.isArray(matches)) {
            chunks = dedupe(matches as unknown as Chunk[]).slice(0, MAX_CHUNKS);
          }
        }

        // No relevant KB context → fixed fallback (no Gemini call)
        if (chunks.length === 0) {
          return staticStreamResponse(NO_KB_MATCH_FALLBACK, messages, persistAssistant);
        }

        // 10-12. Build context, call Gemini
        const kbBlock = buildContextBlock(chunks);
        const titles = Array.from(new Set(chunks.map((c) => c.document_title)));
        const sourceLine = `\n\n— Answer based on ZuZo AI Knowledge Base (${chunks.length} source${chunks.length === 1 ? "" : "s"}: ${titles.join(", ")})`;

        const gemini = createOpenAICompatible({
          name: "google-gemini",
          baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
          apiKey: geminiKey,
        });
        const model = gemini(GEMINI_MODEL);

        const augmentedSystem = `${SYSTEM_PROMPT}\n\nKNOWLEDGE BASE CONTEXT (use this to answer):\n\n${kbBlock}`;

        try {
          const result = streamText({
            model,
            system: augmentedSystem,
            messages: convertToModelMessages(messages),
            onError: (err) => {
              console.error("[gemini] stream error", err.error instanceof Error ? err.error.message : err.error);
            },
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ responseMessage }) => {
              let text = responseMessage.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("")
                .trim();
              // Append source transparency footer if the model produced a grounded answer.
              if (
                text &&
                text !== NO_KB_MATCH_FALLBACK &&
                text !== OUT_OF_SCOPE_FALLBACK &&
                !text.includes("Answer based on ZuZo AI Knowledge Base")
              ) {
                text = `${text}${sourceLine}`;
              }
              await persistAssistant(text);
            },
          });
        } catch (err) {
          console.error("[gemini] request failed", err instanceof Error ? err.message : err);
          return new Response("AI request failed", { status: 502 });
        }
      },
    },
  },
});
