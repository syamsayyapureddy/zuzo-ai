import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogOut, PawPrint, Sparkles, Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/AuthShell";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";

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

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/signin", replace: true });
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("full_name, pet_name, email")
        .eq("id", session.user.id)
        .maybeSingle();
      if (mounted) {
        setProfile(data ?? { full_name: null, pet_name: null, email: session.user.email ?? null });
        setLoading(false);
      }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) navigate({ to: "/signin", replace: true });
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, [navigate]);

  async function onSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
  }

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
      <header className="mx-auto max-w-5xl px-5 sm:px-8 h-16 sm:h-18 flex items-center justify-between">
        <BrandMark />
        <button
          onClick={onSignOut}
          className="inline-flex items-center gap-2 rounded-2xl glass px-4 h-10 text-sm font-medium hover:shadow-soft transition-all"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </header>

      <main className="mx-auto max-w-5xl px-5 sm:px-8 py-10 sm:py-16">
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

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {[
              { icon: PawPrint, label: "Care Tips" },
              { icon: Sparkles, label: "AI Assistant" },
              { icon: PawPrint, label: "Nearby Vets" },
            ].map((c, i) => (
              <div key={i} className="glass rounded-2xl p-5 hover:shadow-soft transition-all hover:-translate-y-0.5">
                <c.icon className="h-6 w-6 text-primary" />
                <div className="mt-3 font-semibold">{c.label}</div>
                <div className="text-sm text-muted-foreground">Coming soon</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
