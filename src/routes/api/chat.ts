import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `You are ZuZo AI 🐾, a warm, expert AI pet care companion. You help pet owners with questions about pet health, nutrition, behavior, vaccinations, grooming, training, and daily care. Be friendly, concise, and practical. Use bullet points when helpful. Always recommend consulting a licensed veterinarian for serious or urgent medical issues, and clearly flag emergencies (e.g. difficulty breathing, seizures, poisoning, severe bleeding) with an urgent note to seek in-person vet care immediately.`;

const GEMINI_MODEL = "gemini-flash-latest";

export const Route = createFileRoute("/api/chat")({
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
        const userId = userData.user.id;

        const body = (await request.json()) as {
          messages?: UIMessage[];
          sessionId?: string;
        };
        const messages = body.messages ?? [];
        const sessionId = body.sessionId;
        if (!sessionId) return new Response("Missing sessionId", { status: 400 });

        const geminiKey = process.env.Gemini_api;
        if (!geminiKey) {
          return new Response("Server misconfigured: missing Gemini API key", { status: 500 });
        }

        // Google Gemini exposes an OpenAI-compatible endpoint.
        const gemini = createOpenAICompatible({
          name: "google-gemini",
          baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
          headers: { Authorization: `Bearer ${geminiKey}` },
        });
        const model = gemini(GEMINI_MODEL);

        // Persist latest user message
        const last = messages[messages.length - 1];
        if (last && last.role === "user") {
          const text = last.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("")
            .trim();
          if (text) {
            await supabase.from("chat_messages").insert({
              user_id: userId,
              session_id: sessionId,
              role: "user",
              content: text,
            });
          }
        }

        try {
          const result = streamText({
            model,
            system: SYSTEM_PROMPT,
            messages: convertToModelMessages(messages),
            onError: (err) => {
              console.error("[gemini] stream error", err);
            },
          });

          return result.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: async ({ responseMessage }) => {
              const text = responseMessage.parts
                .map((p) => (p.type === "text" ? p.text : ""))
                .join("")
                .trim();
              if (text) {
                await supabase.from("chat_messages").insert({
                  user_id: userId,
                  session_id: sessionId,
                  role: "assistant",
                  content: text,
                });
              }
            },
          });
        } catch (err) {
          console.error("[gemini] request failed", err);
          const message = err instanceof Error ? err.message : "Unknown error";
          return new Response(`Gemini request failed: ${message}`, { status: 502 });
        }
      },
    },
  },
});
