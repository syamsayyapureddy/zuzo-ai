import { createFileRoute } from "@tanstack/react-router";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createClient } from "@supabase/supabase-js";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `You are ZuZo AI 🐾, a warm, expert AI pet care companion. You help pet owners with questions about pet health, nutrition, behavior, vaccinations, grooming, training, and daily care. Be friendly, concise, and practical. Use bullet points when helpful. Always recommend consulting a licensed veterinarian for serious or urgent medical issues, and clearly flag emergencies (e.g. difficulty breathing, seizures, poisoning, severe bleeding) with an urgent note to seek in-person vet care immediately.`;

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

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const gateway = createLovableAiGatewayProvider(key);
        const model = gateway("google/gemini-3-flash-preview");

        // Persist latest user message (if new)
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

        const result = streamText({
          model,
          system: SYSTEM_PROMPT,
          messages: convertToModelMessages(messages),
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
      },
    },
  },
});
