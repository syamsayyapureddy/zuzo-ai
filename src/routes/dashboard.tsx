import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Loader2, Plus, PawPrint, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { features } from "@/lib/features";
import { Button } from "@/components/ui/button";
import { useSignedPhotoUrls } from "@/hooks/use-signed-photo-urls";
import { type Pet, speciesEmoji, petAge } from "@/lib/pets";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — ZuZo AI" },
      { name: "description", content: "Your ZuZo AI pet care dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

type Profile = { full_name: string | null; pet_name: string | null; email: string | null };

function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pets, setPets] = useState<Pet[]>([]);
  const photoUrls = useSignedPhotoUrls(pets);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      const [{ data: p }, { data: petRows }] = await Promise.all([
        supabase.from("profiles").select("full_name, pet_name, email").eq("id", session.user.id).maybeSingle(),
        supabase.from("pets").select("*").eq("user_id", session.user.id)
          .order("is_default", { ascending: false }).order("created_at", { ascending: true }),
      ]);
      if (mounted) {
        setProfile(p ?? { full_name: null, pet_name: null, email: session.user.email ?? null });
        setPets((petRows ?? []) as Pet[]);
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/signin", replace: true });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center gradient-hero-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const name = profile?.full_name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen gradient-hero-bg">
      <AppHeader />

      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-8 sm:py-12">
        <div className="glass rounded-3xl p-8 sm:p-12 shadow-glow animate-fade-up">
          <div className="inline-flex items-center gap-2 rounded-full glass-strong px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> You're signed in
          </div>
          <h1 className="mt-4 font-display text-3xl sm:text-5xl font-bold tracking-tight">
            Welcome, {name} <span aria-hidden>🐾</span>
          </h1>
          <p className="mt-3 text-muted-foreground max-w-xl">
            Your ZuZo AI dashboard is ready. Start exploring smart care tips, food recommendations,
            and nearby vet support tailored for {profile?.pet_name || "your pet"}.
          </p>
        </div>

        <section className="mt-8 sm:mt-10">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight">My Pets</h2>
            <div className="flex items-center gap-2">
              {pets.length > 0 && (
                <Link to="/pets" className="text-sm font-medium text-primary hover:underline">View all</Link>
              )}
              <Button asChild size="sm" className="shadow-glow">
                <Link to="/pets">
                  <Plus className="h-4 w-4 mr-1" /> Add Pet
                </Link>
              </Button>
            </div>
          </div>

          {pets.length === 0 ? (
            <div className="glass rounded-2xl p-8 sm:p-10 text-center animate-fade-up">
              <div className="mx-auto h-14 w-14 rounded-2xl gradient-cta grid place-items-center shadow-soft mb-3">
                <PawPrint className="h-7 w-7 text-primary-foreground" />
              </div>
              <div className="font-semibold text-lg">No pets yet</div>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                Add your first pet to unlock personalized reminders, diet plans, and AI health tips.
              </p>
              <Button asChild className="mt-4 shadow-glow">
                <Link to="/pets"><Plus className="h-4 w-4 mr-2" /> Add Your First Pet</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {pets.slice(0, 6).map((pet) => {
                const age = petAge(pet);
                const photoUrl = pet.photo_url ? photoUrls[pet.photo_url] : undefined;
                return (
                  <Link key={pet.id} to="/pets" className="glass rounded-2xl p-5 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-glow">
                    <div className="h-14 w-14 rounded-2xl glass-strong grid place-items-center text-2xl overflow-hidden shrink-0">
                      {photoUrl ? (
                        <img src={photoUrl} alt={pet.name} className="h-full w-full object-cover" />
                      ) : (
                        <span>{speciesEmoji(pet.species)}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold truncate">{pet.name}</div>
                        {pet.is_default && <Star className="h-3.5 w-3.5 text-primary fill-current" />}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[pet.species, pet.breed, age].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <section className="mt-8 sm:mt-10">
          <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight mb-4 sm:mb-6">
            Features
          </h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => {
              const inner = (
                <div className="glass rounded-2xl p-5 h-full transition-all hover:-translate-y-0.5 hover:shadow-glow flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-10 w-10 rounded-xl gradient-cta grid place-items-center shadow-soft">
                      <f.icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                    {f.to ? (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-primary/10 text-primary">
                        Open
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-muted text-muted-foreground">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <div className="mt-3 font-semibold">{f.title}</div>
                  <div className="text-sm text-muted-foreground">{f.description}</div>
                </div>
              );
              return f.to ? (
                <Link key={f.title} to={f.to} className="text-left">
                  {inner}
                </Link>
              ) : (
                <div key={f.title} aria-disabled className="cursor-not-allowed opacity-95">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <FloatingAssistantButton />
    </div>
  );
}
