import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2, PawPrint, Sparkles, AlertTriangle, Upload, ScanSearch, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { Button } from "@/components/ui/button";
import { type Pet, speciesEmoji } from "@/lib/pets";

export const Route = createFileRoute("/breed-identification")({
  head: () => ({
    meta: [
      { title: "Breed Identification — ZuZo AI" },
      { name: "description", content: "Identify your pet's breed from a photo with ZuZo AI vision analysis." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BreedPage,
});

const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;
const SAFETY_NOTICE =
  "Breed identification is AI-generated and provided for general guidance only. Accuracy is not guaranteed and this is not a medical diagnosis — consult a licensed veterinarian for health concerns.";

type BreedResult = {
  primary_breed: string;
  confidence: number;
  alternative_breeds: Array<{ breed: string; confidence: number }>;
  physical_characteristics: string[];
  temperament: string[];
  coat_type: string;
  size_category: string;
  analysis: string;
};

function BreedPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [userId, setUserId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<BreedResult | null>(null);
  const [error, setError] = useState<string>("");
  const [scannedAt, setScannedAt] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/signin", replace: true }); return; }
      setToken(session.access_token);
      setUserId(session.user.id);
      const { data } = await supabase.from("pets").select("*").eq("user_id", session.user.id)
        .order("is_default", { ascending: false }).order("created_at", { ascending: true });
      if (!mounted) return;
      const rows = (data ?? []) as Pet[];
      setPets(rows);
      setSelectedId(rows[0]?.id ?? null);
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/signin", replace: true });
      else setToken(s.access_token);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  const selected = pets.find((p) => p.id === selectedId) ?? null;

  function onPick(f: File | null) {
    setResult(null);
    setError("");
    if (!f) return;
    if (!ACCEPTED.includes(f.type)) { toast.error("Please upload a JPG, PNG or WEBP image."); return; }
    if (f.size > MAX_BYTES) { toast.error("Image must be 10 MB or smaller."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function clearImage() {
    setFile(null);
    setPreview("");
    setResult(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analyze() {
    if (!file) return;
    setAnalyzing(true);
    setResult(null);
    setError("");
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read image"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/breed", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image: dataUrl,
          pet: selected ? { name: selected.name, species: selected.species, breed: selected.breed } : undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }
      const json = await res.json();
      if (!json.identified) {
        setError(json.message || "Unable to identify the breed confidently.");
        return;
      }
      const r = json.result as BreedResult;
      setResult(r);
      setScannedAt(new Date());

      // Store the image + scan
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/breed/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("pet-photos").upload(path, file, {
        cacheControl: "3600", upsert: false, contentType: file.type,
      });
      if (upErr) console.error("[breed] upload failed", upErr.message);
      await supabase.from("breed_scans").insert({
        user_id: userId,
        pet_id: selected?.id ?? null,
        image_url: upErr ? "" : path,
        primary_breed: r.primary_breed,
        alternative_breeds: r.alternative_breeds ?? [],
        confidence: r.confidence,
        analysis: r.analysis ?? "",
      });
      toast.success("Breed identified");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Analysis failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center gradient-hero-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero-bg">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-11 w-11 rounded-2xl gradient-cta grid place-items-center shadow-glow">
            <ScanSearch className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Breed Identification</h1>
            <p className="text-muted-foreground mt-1">Upload a clear photo and let ZuZo AI identify the breed.</p>
          </div>
        </div>

        {pets.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center shadow-glow animate-fade-up mt-6">
            <div className="mx-auto h-16 w-16 rounded-3xl gradient-cta grid place-items-center shadow-soft mb-4">
              <PawPrint className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold">Add a pet first</h2>
            <p className="text-muted-foreground mt-2">Create a pet profile so we can link the scan to your pet.</p>
            <Button asChild className="mt-5 shadow-glow"><Link to="/pets">Go to My Pets</Link></Button>
          </div>
        ) : (
          <>
            <section className="glass rounded-3xl p-5 sm:p-6 shadow-soft mt-6 animate-fade-up">
              <h2 className="font-semibold text-lg mb-3">Select a pet</h2>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {pets.map((p) => {
                  const active = p.id === selectedId;
                  return (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedId(p.id); setResult(null); setError(""); }}
                      className={`text-left rounded-2xl p-4 transition-all border ${active ? "border-primary bg-primary/5 shadow-glow" : "border-border/60 glass hover:-translate-y-0.5"}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-11 w-11 rounded-xl glass-strong grid place-items-center text-2xl">{speciesEmoji(p.species)}</div>
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{p.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.species}{p.breed ? ` · ${p.breed}` : ""}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <h2 className="font-semibold text-lg mt-6 mb-3">Upload a photo</h2>
              {preview ? (
                <div className="relative rounded-2xl overflow-hidden border border-border/60 max-w-md">
                  <img src={preview} alt="Pet photo to analyze" className="w-full h-64 object-cover" />
                  <button
                    onClick={clearImage}
                    aria-label="Remove image"
                    className="absolute top-2 right-2 h-9 w-9 rounded-xl glass-strong grid place-items-center hover:shadow-soft"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-2xl border-2 border-dashed border-border/70 hover:border-primary/60 transition-colors p-10 text-center glass"
                >
                  <Upload className="h-7 w-7 mx-auto text-primary" />
                  <div className="mt-2 font-medium">Click to upload a pet photo</div>
                  <div className="text-xs text-muted-foreground mt-1">JPG, PNG or WEBP · max 10 MB</div>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />

              <div className="mt-4">
                <Button onClick={analyze} disabled={!file || analyzing} className="shadow-glow">
                  {analyzing
                    ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Analyzing…</>
                    : <><Sparkles className="h-4 w-4 mr-2" /> Identify Breed</>}
                </Button>
              </div>
            </section>

            {analyzing && (
              <div className="glass rounded-3xl p-8 mt-6 text-center animate-fade-up">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                <p className="mt-3 text-sm text-muted-foreground">ZuZo AI is examining the photo…</p>
              </div>
            )}

            {error && !analyzing && (
              <div className="mt-6 glass rounded-2xl p-5 border border-destructive/30 bg-destructive/5 flex items-start gap-3 animate-fade-up">
                <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">{error}</div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Try a well-lit, close-up photo showing the whole animal.
                  </p>
                </div>
              </div>
            )}

            {result && !analyzing && (
              <section className="glass rounded-3xl p-5 sm:p-6 shadow-glow mt-6 animate-fade-up">
                <div className="grid gap-6 md:grid-cols-[240px_1fr]">
                  {preview && (
                    <img src={preview} alt={`Analyzed photo of ${selected?.name ?? "pet"}`} className="w-full h-56 md:h-full object-cover rounded-2xl border border-border/60" />
                  )}
                  <div>
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Primary breed</div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">{result.primary_breed}</h2>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Confidence</span>
                        <span className="font-semibold">{result.confidence}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full gradient-cta" style={{ width: `${result.confidence}%` }} />
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">Coat: {result.coat_type}</span>
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">Size: {result.size_category}</span>
                    </div>
                    {result.analysis && <p className="mt-4 text-sm text-muted-foreground">{result.analysis}</p>}
                    {scannedAt && (
                      <p className="mt-3 text-xs text-muted-foreground">Scanned {scannedAt.toLocaleString()}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3 mt-6">
                  <InfoList title="Alternative breeds" items={(result.alternative_breeds ?? []).map((a) => `${a.breed} — ${a.confidence}%`)} />
                  <InfoList title="Physical characteristics" items={result.physical_characteristics ?? []} />
                  <InfoList title="Temperament" items={result.temperament ?? []} />
                </div>
              </section>
            )}

            <div className="mt-6 glass rounded-2xl p-4 text-sm text-muted-foreground flex items-start gap-2 border border-border/60">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <span>{SAFETY_NOTICE}</span>
            </div>
          </>
        )}
      </main>
      <FloatingAssistantButton />
    </div>
  );
}

function InfoList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-border/60 p-4">
      <div className="font-semibold text-sm mb-2">{title}</div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {items.length === 0 ? <li>—</li> : items.map((it, i) => (
          <li key={i} className="flex gap-2"><span className="text-primary">•</span><span>{it}</span></li>
        ))}
      </ul>
    </div>
  );
}
