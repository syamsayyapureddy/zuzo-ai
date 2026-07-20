import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Apple, Sparkles, AlertTriangle, PawPrint } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { Button } from "@/components/ui/button";
import { type Pet, speciesEmoji, petAge } from "@/lib/pets";

export const Route = createFileRoute("/nutrition")({
  head: () => ({
    meta: [
      { title: "Diet & Nutrition Planner — ZuZo AI" },
      { name: "description", content: "AI-powered personalized diet & nutrition plans for your pet." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: NutritionPage,
});

type Plan = {
  daily_summary: {
    daily_calories: string; meal_frequency: string; water_intake: string;
    protein: string; fat: string; fiber: string;
  };
  feeding_schedule: Array<{ time: string; meal: string; portion: string; notes: string }>;
  recommended_foods: Array<{ food: string; benefits: string; frequency: string }>;
  foods_to_avoid: Array<{ food: string; reason: string }>;
  healthy_treats: Array<{ treat: string; serving: string }>;
  tips: string[];
};

type PlanResponse = { plan: Plan; source: "knowledge_base" | "general"; sources: string[] };

const SAFETY_NOTICE =
  "This diet plan provides general pet nutrition guidance and is not a substitute for professional veterinary advice. Pets with medical conditions, allergies, or special dietary needs should be evaluated by a licensed veterinarian.";

function NutritionPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<PlanResponse | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/signin", replace: true }); return; }
      setToken(session.access_token);
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
  const missingEssentials = selected
    ? !selected.species || (!selected.date_of_birth && !selected.age_text) || !selected.weight_kg
    : true;

  async function generate() {
    if (!selected) return;
    if (missingEssentials) {
      toast.error("Please complete your pet's profile (species, age, weight) first.");
      return;
    }
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pet: {
            name: selected.name,
            species: selected.species,
            breed: selected.breed,
            age: petAge(selected),
            weight: selected.weight_kg ? `${selected.weight_kg} kg` : null,
            gender: selected.gender,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || "Request failed");
      }
      const json = (await res.json()) as PlanResponse;
      setResult(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate plan");
    } finally {
      setGenerating(false);
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
            <Apple className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">Diet & Nutrition Planner</h1>
            <p className="text-muted-foreground mt-1">Personalized, AI-powered meal plans for your pet.</p>
          </div>
        </div>

        {pets.length === 0 ? (
          <div className="glass rounded-3xl p-10 text-center shadow-glow animate-fade-up mt-6">
            <div className="mx-auto h-16 w-16 rounded-3xl gradient-cta grid place-items-center shadow-soft mb-4">
              <PawPrint className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="font-display text-2xl font-bold">Add a pet first</h2>
            <p className="text-muted-foreground mt-2">Create a pet profile so we can craft a personalized plan.</p>
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
                      onClick={() => { setSelectedId(p.id); setResult(null); }}
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

              {selected && (
                <div className="mt-5">
                  <PetInfoTable pet={selected} />
                  {missingEssentials && (
                    <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 px-4 py-3 text-sm flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>
                        Please complete this pet's profile (species, age or date of birth, and weight) before generating a plan.{" "}
                        <Link to="/pets" className="underline font-medium">Update profile</Link>
                      </span>
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <Button onClick={generate} disabled={generating || missingEssentials} className="shadow-glow">
                      {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate Diet Plan</>}
                    </Button>
                    {result && (
                      <span className="text-xs text-muted-foreground">
                        Source: {result.source === "knowledge_base" ? `ZuZo Knowledge Base${result.sources.length ? ` (${result.sources.join(", ")})` : ""}` : "General pet-care knowledge"}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {result && selected && <PlanView plan={result.plan} />}

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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <tr className="border-b border-border/40 last:border-0">
      <td className="py-2 pr-4 text-muted-foreground font-medium whitespace-nowrap">{k}</td>
      <td className="py-2">{v}</td>
    </tr>
  );
}

function PetInfoTable({ pet }: { pet: Pet }) {
  const age = petAge(pet);
  return (
    <div className="glass-strong rounded-2xl p-4">
      <h3 className="font-semibold mb-2">Pet Information</h3>
      <table className="w-full text-sm">
        <tbody>
          <Row k="Pet Name" v={pet.name} />
          <Row k="Species" v={pet.species} />
          <Row k="Breed" v={pet.breed || "—"} />
          <Row k="Age" v={age || "—"} />
          <Row k="Weight" v={pet.weight_kg ? `${pet.weight_kg} kg` : "—"} />
          <Row k="Gender" v={pet.gender || "—"} />
        </tbody>
      </table>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass rounded-3xl p-5 sm:p-6 shadow-soft mt-6 animate-fade-up">
      <h2 className="font-display text-xl font-bold mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
            {headers.map((h) => <th key={h} className="py-2 pr-4 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border/40">
              {r.map((c, j) => <td key={j} className="py-2 pr-4 align-top">{c || "—"}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlanView({ plan }: { plan: Plan }) {
  const s = plan.daily_summary || ({} as Plan["daily_summary"]);
  return (
    <>
      <SectionCard title="Daily Nutrition Summary">
        <Table
          headers={["Category", "Recommendation"]}
          rows={[
            ["Daily Calories", s.daily_calories],
            ["Meal Frequency", s.meal_frequency],
            ["Water Intake", s.water_intake],
            ["Protein", s.protein],
            ["Fat", s.fat],
            ["Fiber", s.fiber],
          ]}
        />
      </SectionCard>

      <SectionCard title="Feeding Schedule">
        <Table
          headers={["Time", "Meal", "Portion", "Notes"]}
          rows={(plan.feeding_schedule ?? []).map((r) => [r.time, r.meal, r.portion, r.notes])}
        />
      </SectionCard>

      <SectionCard title="Recommended Foods">
        <Table
          headers={["Food", "Benefits", "Frequency"]}
          rows={(plan.recommended_foods ?? []).map((r) => [r.food, r.benefits, r.frequency])}
        />
      </SectionCard>

      <SectionCard title="Foods to Avoid">
        <Table
          headers={["Food", "Reason"]}
          rows={(plan.foods_to_avoid ?? []).map((r) => [r.food, r.reason])}
        />
      </SectionCard>

      <SectionCard title="Healthy Treats">
        <Table
          headers={["Treat", "Serving Recommendation"]}
          rows={(plan.healthy_treats ?? []).map((r) => [r.treat, r.serving])}
        />
      </SectionCard>

      <SectionCard title="Nutrition Tips">
        <ul className="list-disc pl-5 space-y-1.5 text-sm">
          {(plan.tips ?? []).map((t, i) => <li key={i}>{t}</li>)}
        </ul>
      </SectionCard>
    </>
  );
}
