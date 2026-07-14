import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowLeft, Loader2, PawPrint, Plus, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/AuthShell";

export const Route = createFileRoute("/assistant")({
  head: () => ({
    meta: [
      { title: "AI Assistant — ZuZo AI" },
      { name: "description", content: "Chat with ZuZo AI about your pet's health, nutrition, behavior, and daily care." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AssistantPage,
});

const SUGGESTIONS = [
  "My pet is not eating",
  "Vaccination schedule",
  "Healthy diet",
  "Grooming tips",
  "Pet behavior",
  "Emergency advice",
];

const SESSION_STORAGE_KEY = "zuzo.assistant.sessionId";

function newSessionId() {
  return crypto.randomUUID();
}

function AssistantPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);
  const [token, setToken] = useState<string>("");

  // Auth + hydrate session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      if (!mounted) return;
      setUserId(session.user.id);
      setToken(session.access_token);

      let sid = typeof window !== "undefined" ? localStorage.getItem(SESSION_STORAGE_KEY) : null;
      if (!sid) {
        sid = newSessionId();
        localStorage.setItem(SESSION_STORAGE_KEY, sid);
      }

      const { data: rows } = await supabase
        .from("chat_messages")
        .select("id, role, content, created_at")
        .eq("user_id", session.user.id)
        .eq("session_id", sid)
        .order("created_at", { ascending: true });

      const msgs: UIMessage[] = (rows ?? []).map((r) => ({
        id: r.id,
        role: r.role as "user" | "assistant",
        parts: [{ type: "text", text: r.content }],
      }));

      if (!mounted) return;
      setSessionId(sid);
      setInitialMessages(msgs);
      setReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/signin", replace: true });
      else setToken(s.access_token);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center gradient-hero-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <ChatView
      key={sessionId}
      sessionId={sessionId}
      token={token}
      initialMessages={initialMessages}
      onNewChat={() => {
        const sid = newSessionId();
        localStorage.setItem(SESSION_STORAGE_KEY, sid);
        setSessionId(sid);
        setInitialMessages([]);
      }}
      userId={userId!}
    />
  );
}

function ChatView({
  sessionId,
  token,
  initialMessages,
  onNewChat,
  userId: _userId,
}: {
  sessionId: string;
  token: string;
  initialMessages: UIMessage[];
  onNewChat: () => void;
  userId: string;
}) {
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({ Authorization: `Bearer ${tokenRef.current}` }),
        body: () => ({ sessionId }),
      }),
    [sessionId],
  );

  const { messages, sendMessage, status, error, stop } = useChat({
    id: sessionId,
    messages: initialMessages,
    transport,
    onError: (e) => toast.error(e.message || "Something went wrong"),
  });

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, status]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [sessionId, status]);

  const busy = status === "submitted" || status === "streaming";

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    await sendMessage({ text: t });
  }

  return (
    <div className="min-h-screen flex flex-col gradient-hero-bg">
      <header className="mx-auto w-full max-w-4xl px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center h-9 w-9 rounded-xl glass hover:shadow-soft transition-all"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <BrandMark />
        </div>
        <button
          onClick={onNewChat}
          className="inline-flex items-center gap-2 rounded-2xl glass px-4 h-10 text-sm font-medium hover:shadow-soft transition-all"
        >
          <Plus className="h-4 w-4" /> New Chat
        </button>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 sm:px-6 pb-4 flex flex-col min-h-0">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-3xl glass p-4 sm:p-6 shadow-soft"
        >
          {messages.length === 0 ? (
            <WelcomeState onPick={(s) => send(s)} />
          ) : (
            <ul className="space-y-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {status === "submitted" && <TypingBubble />}
              {error && (
                <li className="text-sm text-destructive px-2">{error.message}</li>
              )}
            </ul>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="mt-3 glass rounded-3xl p-2 flex items-end gap-2 shadow-soft"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask ZuZo about your pet…"
            className="flex-1 resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground max-h-40"
          />
          {busy ? (
            <button
              type="button"
              onClick={() => stop()}
              className="h-11 px-4 rounded-2xl bg-muted text-foreground text-sm font-medium hover:opacity-90 transition-all"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="h-11 w-11 grid place-items-center rounded-2xl gradient-cta text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none transition-all"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </form>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          ZuZo AI can make mistakes. For emergencies, contact your vet immediately.
        </p>
      </main>
    </div>
  );
}

function WelcomeState({ onPick }: { onPick: (s: string) => void }) {
  return (
    <div className="h-full min-h-[50vh] grid place-items-center animate-fade-up">
      <div className="text-center max-w-xl">
        <div className="mx-auto h-16 w-16 rounded-3xl gradient-cta grid place-items-center shadow-glow">
          <PawPrint className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full glass-strong px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3.5 w-3.5" /> AI Pet Assistant
        </div>
        <h1 className="mt-3 font-display text-2xl sm:text-3xl font-bold tracking-tight">
          Hi! I'm ZuZo AI <span aria-hidden>🐾</span>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Ask me anything about your pet's health, nutrition, behavior, vaccinations, grooming, or daily care.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="rounded-full glass px-4 py-2 text-sm hover:shadow-soft hover:-translate-y-0.5 transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const text = message.parts
    .map((p) => (p.type === "text" ? p.text : ""))
    .join("");
  return (
    <li className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-up`}>
      {!isUser && (
        <div className="mr-2 h-8 w-8 shrink-0 rounded-2xl gradient-cta grid place-items-center shadow-soft">
          <PawPrint className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
      <div
        className={
          isUser
            ? "max-w-[80%] rounded-3xl rounded-br-md bg-primary text-primary-foreground px-4 py-3 text-sm whitespace-pre-wrap shadow-soft"
            : "max-w-[85%] rounded-3xl rounded-bl-md glass-strong text-foreground px-4 py-3 text-sm whitespace-pre-wrap"
        }
      >
        {text}
      </div>
    </li>
  );
}

function TypingBubble() {
  return (
    <li className="flex justify-start animate-fade-up">
      <div className="mr-2 h-8 w-8 shrink-0 rounded-2xl gradient-cta grid place-items-center shadow-soft">
        <PawPrint className="h-4 w-4 text-primary-foreground" />
      </div>
      <div className="rounded-3xl rounded-bl-md glass-strong px-4 py-3 flex items-center gap-1">
        <span className="h-2 w-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="h-2 w-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "120ms" }} />
        <span className="h-2 w-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: "240ms" }} />
      </div>
    </li>
  );
}
