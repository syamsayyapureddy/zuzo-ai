import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const CHAT_MODEL = "google/gemini-2.5-flash";
const LOVABLE_AI_BASE = "https://ai.gateway.lovable.dev/v1";
const MIN_CONFIDENCE = 60;

type PetInput = { name?: string; species?: string; breed?: string | null };

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

export const Route = createFileRoute("/api/breed")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization") ?? "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { persistSession: false, autoRefreshToken: false },
          },
        );
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData?.user) return new Response("Unauthorized", { status: 401 });

        const body = (await request.json()) as { image?: string; pet?: PetInput };
        const image = body.image;
        if (!image || !image.startsWith("data:image/")) {
          return new Response(JSON.stringify({ error: "Missing or invalid image" }), {
            status: 400, headers: { "Content-Type": "application/json" },
          });
        }

        const lovableKey = process.env.LOVABLE_API_KEY;
        if (!lovableKey) {
          return new Response(JSON.stringify({ error: "Server misconfigured" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }

        const pet = body.pet ?? {};
        const schemaHint = `{
  "is_animal": boolean,
  "primary_breed": string,
  "confidence": number,
  "alternative_breeds": [{ "breed": string, "confidence": number }],
  "physical_characteristics": [string],
  "temperament": [string],
  "coat_type": string,
  "size_category": string,
  "analysis": string
}`;

        const system = `You are ZuZo AI 🐾, an AI veterinary breed identification assistant.
Analyze the uploaded image carefully and identify the most likely breed of the animal.
Rules:
- Never identify humans. If the image shows a person or no animal, set "is_animal": false and confidence 0.
- Never provide medical diagnoses and never guarantee accuracy.
- confidence is an integer between 0 and 100 reflecting your true certainty.
- alternative_breeds: 2-4 plausible alternatives with their own confidence values.
- physical_characteristics: 4-6 short observations. temperament: 4-6 short traits.
- Support all companion species (dogs, cats, rabbits, birds, horses, etc.).
Return ONLY a single valid JSON object matching this shape (no prose, no markdown fences):
${schemaHint}`;

        const promptText = `Owner-provided context (may be inaccurate, verify visually):
- Pet name: ${pet.name || "Unknown"}
- Species: ${pet.species || "Unknown"}
- Claimed breed: ${pet.breed || "Unknown"}

Identify the breed from the image and return the JSON now.`;

        const gateway = createOpenAICompatible({
          name: "lovable-ai",
          baseURL: LOVABLE_AI_BASE,
          headers: { "Lovable-API-Key": lovableKey },
        });

        try {
          const { text } = await generateText({
            model: gateway(CHAT_MODEL),
            system,
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  { type: "image", image },
                ],
              },
            ],
          });
          const parsed = extractJson(text) as Record<string, unknown> | null;
          if (!parsed) {
            return new Response(JSON.stringify({ error: "Could not parse AI response" }), {
              status: 502, headers: { "Content-Type": "application/json" },
            });
          }

          const confidence = Math.max(0, Math.min(100, Math.round(Number(parsed.confidence) || 0)));
          const isAnimal = parsed.is_animal !== false;
          if (!isAnimal || confidence < MIN_CONFIDENCE) {
            return new Response(
              JSON.stringify({
                identified: false,
                confidence,
                message: "Unable to identify the breed confidently.",
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          }

          return new Response(
            JSON.stringify({ identified: true, result: { ...parsed, confidence } }),
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (err) {
          console.error("[breed] analysis failed", err instanceof Error ? err.message : err);
          return new Response(JSON.stringify({ error: "AI request failed" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
