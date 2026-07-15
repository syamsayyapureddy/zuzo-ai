import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, LogOut, Pencil, Mail, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Profile — ZuZo AI" },
      { name: "description", content: "Your ZuZo AI profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

type Profile = { full_name: string | null; email: string | null; avatar_url?: string | null };

function ProfilePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate({ to: "/signin", replace: true }); return; }
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", session.user.id)
        .maybeSingle();
      if (mounted) {
        setProfile(data ?? { full_name: null, email: session.user.email ?? null });
        setLoading(false);
      }
    })();
  }, [navigate]);

  async function onSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/signin", replace: true });
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center gradient-hero-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const name = profile?.full_name || "Pet Parent";
  const email = profile?.email || "—";
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen gradient-hero-bg">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-5 sm:px-8 py-8 sm:py-12">
        <div className="glass rounded-3xl p-8 sm:p-10 shadow-glow animate-fade-up text-center">
          <div className="mx-auto h-24 w-24 rounded-full gradient-primary grid place-items-center shadow-glow text-3xl font-display font-bold text-white">
            {initial}
          </div>
          <h1 className="mt-5 font-display text-2xl sm:text-3xl font-bold tracking-tight">{name}</h1>
          <div className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" /> {email}
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <button
              onClick={() => toast.info("Edit profile coming soon")}
              className="inline-flex items-center justify-center gap-2 rounded-2xl gradient-cta text-primary-foreground h-11 px-5 text-sm font-medium shadow-soft hover:shadow-glow transition-all"
            >
              <Pencil className="h-4 w-4" /> Edit Profile
            </button>
            <button
              onClick={onSignOut}
              className="inline-flex items-center justify-center gap-2 rounded-2xl glass h-11 px-5 text-sm font-medium hover:shadow-soft transition-all"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </div>

        <div className="mt-6 glass rounded-2xl p-5 flex items-center gap-3">
          <UserIcon className="h-5 w-5 text-primary" />
          <div className="text-sm text-muted-foreground">
            Profile management features are coming soon.
          </div>
        </div>
      </main>
      <FloatingAssistantButton />
    </div>
  );
}
