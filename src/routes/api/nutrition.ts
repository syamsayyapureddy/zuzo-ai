import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CHAT_MODEL = "google/gemini-2.5-flash";
const EMBED_MODEL = "gemini-embedding-001";
const EMBED_DIMS = 768;
const MAX_CHUNKS = 5;
const MIN_SIMILARITY = 0.35;
const FALLBACK_MIN_SIMILARITY = 0.15;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const LOVABLE_AI_BASE = "https://ai.gateway.lovable.dev/v1";

type PetInput = {
  name: string;
  species: string;
  breed?: string | null;
  age?: string | null;
  weight?: string | null;
  gender?: string | null;
};

type Chunk = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  chunk_index: number;
  chunk_text: string;
  similarity: number;
};

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
    if (!res.ok) return null;
    const json = (await res.json()) as { embedding?: { values?: number[] } };
    return json.embedding?.values ?? null;
  } catch {
    return null;
  }
}

function extractJson(text: string): unknown | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence ? fence[1] : text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const first = candidate.indexOf("{");
    const last = candidate.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try { return JSON.parse(candidate.slice(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}

export const Route = createFileRoute("/api/nutrition")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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

        const body = (await request.json()) as { pet?: PetInput };
        const pet = body.pet;
        if (!pet?.name || !pet.species) {
          return new Response(JSON.stringify({ error: "Missing pet info" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const geminiKey = process.env.Gemini_api;
        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        // RAG retrieval
        const query = `Diet and nutrition plan for a ${pet.species}${pet.breed ? ` (${pet.breed})` : ""}${pet.age ? `, age ${pet.age}` : ""}${pet.weight ? `, weight ${pet.weight}` : ""}. Daily calories, meal frequency, water, protein, fat, fiber, feeding schedule, recommended foods, foods to avoid, healthy treats, nutrition tips.`;

        let chunks: Chunk[] = [];
        if (geminiKey) {
          const embedding = await embedQuery(query, geminiKey);
          if (embedding && embedding.length === EMBED_DIMS) {
            const runMatch = async (threshold: number) => {
              const { data: matches } = await supabase.rpc(
                "match_knowledge_chunks" as never,
                {
                  query_embedding: `[${embedding.join(",")}]` as unknown as never,
                  match_count: MAX_CHUNKS,
                  min_similarity: threshold,
                } as never,
              );
              return Array.isArray(matches) ? (matches as unknown as Chunk[]) : [];
            };
            chunks = await runMatch(MIN_SIMILARITY);
            if (chunks.length === 0) chunks = await runMatch(FALLBACK_MIN_SIMILARITY);
          }
        }
        const hasKB = chunks.length > 0;
        const kbBlock = hasKB
          ? chunks.map((c, i) => `Source ${i + 1} — ${c.document_title}\n${c.chunk_text}`).join("\n\n---\n\n")
          : "";
        console.log(`[nutrition] Response source: ${hasKB ? "KNOWLEDGE_BASE" : "GEMINI_GENERAL_FALLBACK"} (${chunks.length} chunks)`);

        const schemaHint = `{
  "daily_summary": {
    "daily_calories": string, "meal_frequency": string, "water_intake": string,
    "protein": string, "fat": string, "fiber": string
  },
  "feeding_schedule": [{ "time": string, "meal": string, "portion": string, "notes": string }],
  "recommended_foods": [{ "food": string, "benefits": string, "frequency": string }],
  "foods_to_avoid": [{ "food": string, "reason": string }],
  "healthy_treats": [{ "treat": string, "serving": string }],
  "tips": [string]
}`;

        const system = `You are ZuZo AI 🐾, a pet nutrition specialist.
${hasKB ? "Use the KNOWLEDGE BASE CONTEXT below as your primary source." : "Answer from general pet-care nutrition knowledge."}
Support ALL companion species (dog, cat, rabbit, ferret, hamster, guinea pig, bird, fish, reptile, horse, etc.), adapting units and foods to the species.
Never diagnose diseases or prescribe medications. Always recommend consulting a licensed veterinarian for special needs.
Return ONLY a single valid JSON object matching this shape (no prose, no markdown fences):
${schemaHint}
Rules:
- Every field must be filled with concrete, species-appropriate values (no empty strings).
- feeding_schedule MUST include at least Morning, Afternoon, and Evening entries.
- recommended_foods: 4-6 items. foods_to_avoid: 4-6 items. healthy_treats: 3-5 items. tips: 5-7 bullets.
- Keep every value short (under ~120 chars), well-organized for table display.`;

        const prompt = `Pet:
- Name: ${pet.name}
- Species: ${pet.species}
- Breed: ${pet.breed || "Unknown"}
- Age: ${pet.age || "Unknown"}
- Weight: ${pet.weight || "Unknown"}
- Gender: ${pet.gender || "Unknown"}

${hasKB ? `KNOWLEDGE BASE CONTEXT:\n${kbBlock}\n\n` : ""}Generate the diet & nutrition plan JSON now.`;

        const gateway = createOpenAICompatible({
          name: "lovable-ai",
          baseURL: LOVABLE_AI_BASE,
          headers: { "Lovable-API-Key": lovableKey },
        });

        try {
          const { text } = await generateText({
            model: gateway(CHAT_MODEL),
            system,
            prompt,
          });
          const parsed = extractJson(text);
          if (!parsed) {
            return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
              status: 502, headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({
              plan: parsed,
              source: hasKB ? "knowledge_base" : "general",
              sources: hasKB ? Array.from(new Set(chunks.map((c) => c.document_title))) : [],
            }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("[nutrition] gen failed", err instanceof Error ? err.message : err);
          return new Response(JSON.stringify({ error: "AI request failed" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
