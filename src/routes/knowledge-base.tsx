import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  FileText,
  Loader2,
  RefreshCw,
  Trash2,
  Upload,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { useRole } from "@/hooks/use-role";
import { ShieldAlert } from "lucide-react";
import {
  createKnowledgeDocument,
  deleteKnowledgeDocument,
  getKnowledgeDocumentStatus,
  listKnowledgeDocuments,
  processKnowledgeDocument,
} from "@/lib/knowledge-base.functions";


export const Route = createFileRoute("/knowledge-base")({
  head: () => ({
    meta: [
      { title: "Knowledge Base — ZuZo AI" },
      { name: "description", content: "Upload documents to your ZuZo AI knowledge base." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: KnowledgeBasePage,
});

type Doc = {
  id: string;
  title: string;
  file_name: string;
  file_type: string;
  processing_status: string;
  total_chunks: number;
  error_message: string | null;
  created_at: string;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ".txt,.md,.markdown,text/plain,text/markdown";

function statusBadge(status: string) {
  const map: Record<string, { icon: typeof Clock; label: string; className: string }> = {
    uploaded: { icon: Clock, label: "Uploaded", className: "bg-muted text-muted-foreground" },
    processing: { icon: Loader2, label: "Processing", className: "bg-primary/10 text-primary" },
    ready: { icon: CheckCircle2, label: "Ready", className: "bg-primary/15 text-primary" },
    failed: { icon: AlertCircle, label: "Failed", className: "bg-destructive/10 text-destructive" },
  };
  const item = map[status] ?? map.uploaded;
  const Icon = item.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${item.className}`}>
      <Icon className={`h-3 w-3 ${status === "processing" ? "animate-spin" : ""}`} />
      {item.label}
    </span>
  );
}

function KnowledgeBasePage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const list = useServerFn(listKnowledgeDocuments);
  const create = useServerFn(createKnowledgeDocument);
  const process = useServerFn(processKnowledgeDocument);
  const status = useServerFn(getKnowledgeDocumentStatus);
  const remove = useServerFn(deleteKnowledgeDocument);

  async function refresh() {
    setLoading(true);
    try {
      const data = await list();
      setDocs(data as Doc[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      if (mounted) {
        setReady(true);
        await refresh();
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/signin", replace: true });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function onUpload() {
    if (!file) return toast.error("Choose a file");
    if (!title.trim()) return toast.error("Enter a title");
    if (file.size > MAX_BYTES) return toast.error("Max file size 5MB");
    if (!/\.(txt|md|markdown)$/i.test(file.name)) return toast.error("Only TXT or Markdown");

    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");
      const path = `${user.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;

      const { error: upErr } = await supabase.storage
        .from("knowledge-base")
        .upload(path, file, { contentType: file.type || "text/plain", upsert: false });
      if (upErr) throw new Error(upErr.message);

      const { id } = await create({
        data: {
          title: title.trim(),
          fileName: file.name,
          fileType: file.type || "text/plain",
          filePath: path,
        },
      });

      toast.success("Uploaded. Processing…");
      setTitle("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await refresh();

      // Fire processing (do not await in UI beyond kickoff notification)
      process({ data: { documentId: id } })
        .then(() => {
          toast.success("Document ready");
          refresh();
        })
        .catch((e) => {
          toast.error(e instanceof Error ? e.message : "Processing failed");
          refresh();
        });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function onRefreshOne(id: string) {
    try {
      const row = await status({ data: { documentId: id } });
      setDocs((prev) =>
        prev.map((d) =>
          d.id === id
            ? {
                ...d,
                processing_status: row.processing_status,
                total_chunks: row.total_chunks,
                error_message: row.error_message,
              }
            : d,
        ),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refresh failed");
    }
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this document and all its chunks?")) return;
    try {
      await remove({ data: { documentId: id } });
      setDocs((prev) => prev.filter((d) => d.id !== id));
      toast.success("Deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center gradient-hero-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero-bg">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-12">
        <div className="glass rounded-3xl p-6 sm:p-8 shadow-glow animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-cta grid place-items-center shadow-soft">
              <BookOpen className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Knowledge Base</h1>
              <p className="text-sm text-muted-foreground">Upload TXT or Markdown files for ZuZo AI to learn from.</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              className="w-full rounded-xl glass px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
            <input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary file:font-medium"
            />
            <button
              onClick={onUpload}
              disabled={uploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl gradient-cta px-4 py-3 text-sm font-semibold text-primary-foreground shadow-soft disabled:opacity-60"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Upload & Process
            </button>
            <p className="text-[11px] text-muted-foreground">TXT or Markdown, max 5MB.</p>
          </div>
        </div>

        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight">Your documents</h2>
            <button
              onClick={refresh}
              className="inline-flex items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-xs font-medium hover:shadow-soft"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          {docs.length === 0 ? (
            <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">
              No documents yet. Upload one above.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {docs.map((d) => (
                <div key={d.id} className="glass rounded-2xl p-4 flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-sm truncate">{d.title}</div>
                      {statusBadge(d.processing_status)}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{d.file_name}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {d.total_chunks} chunk{d.total_chunks === 1 ? "" : "s"}
                      {d.error_message ? ` • ${d.error_message}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onRefreshOne(d.id)}
                      aria-label="Refresh status"
                      className="h-8 w-8 rounded-lg grid place-items-center hover:bg-primary/10 transition-colors"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(d.id)}
                      aria-label="Delete"
                      className="h-8 w-8 rounded-lg grid place-items-center hover:bg-destructive/10 text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      <FloatingAssistantButton />
    </div>
  );
}
