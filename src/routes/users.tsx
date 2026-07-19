import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldAlert, Users as UsersIcon, Crown, Shield, User as UserIcon } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { FloatingAssistantButton } from "@/components/FloatingAssistantButton";
import { listUsersWithRoles, setUserRole } from "@/lib/roles.functions";
import { useRole } from "@/hooks/use-role";

export const Route = createFileRoute("/users")({
  head: () => ({
    meta: [
      { title: "User Management — ZuZo AI" },
      { name: "description", content: "Manage roles and permissions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: UsersPage,
});

type Row = { id: string; email: string; created_at: string; role: "owner" | "admin" | "user" };

function roleBadge(role: Row["role"]) {
  const map = {
    owner: { icon: Crown, label: "Owner", cls: "bg-primary/15 text-primary" },
    admin: { icon: Shield, label: "Admin", cls: "bg-accent/40 text-foreground" },
    user: { icon: UserIcon, label: "User", cls: "bg-muted text-muted-foreground" },
  } as const;
  const it = map[role];
  const Icon = it.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${it.cls}`}>
      <Icon className="h-3 w-3" /> {it.label}
    </span>
  );
}

function UsersPage() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useRole();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const list = useServerFn(listUsersWithRoles);
  const setRoleFn = useServerFn(setUserRole);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return navigate({ to: "/signin", replace: true });
    })();
  }, [navigate]);

  useEffect(() => {
    if (roleLoading) return;
    if (role !== "owner") return;
    list()
      .then((d) => setRows(d as Row[]))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed to load users"));
  }, [role, roleLoading, list]);

  if (roleLoading) {
    return (
      <div className="min-h-screen grid place-items-center gradient-hero-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (role !== "owner") {
    return (
      <div className="min-h-screen gradient-hero-bg">
        <AppHeader />
        <main className="mx-auto max-w-lg px-5 py-16 text-center">
          <div className="glass rounded-3xl p-10 shadow-glow">
            <ShieldAlert className="h-10 w-10 text-destructive mx-auto" />
            <h1 className="mt-4 font-display text-2xl font-bold">403 — Unauthorized</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Only the Owner can manage user roles.
            </p>
          </div>
        </main>
      </div>
    );
  }

  async function changeRole(userId: string, next: "admin" | "user") {
    setBusy(userId);
    try {
      await setRoleFn({ data: { userId, role: next } });
      setRows((prev) => prev?.map((r) => (r.id === userId ? { ...r, role: next } : r)) ?? null);
      toast.success(`Role updated to ${next}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update role");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen gradient-hero-bg">
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 sm:px-8 py-8 sm:py-12">
        <div className="glass rounded-3xl p-6 sm:p-8 shadow-glow animate-fade-up">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl gradient-cta grid place-items-center shadow-soft">
              <UsersIcon className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">User Management</h1>
              <p className="text-sm text-muted-foreground">Promote users to admin or demote admins to users.</p>
            </div>
          </div>
        </div>

        <section className="mt-6 flex flex-col gap-3">
          {!rows ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            rows.map((r) => (
              <div key={r.id} className="glass rounded-2xl p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-full gradient-primary grid place-items-center text-white font-bold">
                  {r.email.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-semibold text-sm truncate">{r.email}</div>
                    {roleBadge(r.role)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.role === "owner" ? (
                    <span className="text-[11px] text-muted-foreground">Protected</span>
                  ) : r.role === "admin" ? (
                    <button
                      disabled={busy === r.id}
                      onClick={() => changeRole(r.id, "user")}
                      className="rounded-lg glass px-3 py-1.5 text-xs font-semibold hover:shadow-soft disabled:opacity-60"
                    >
                      Demote to User
                    </button>
                  ) : (
                    <button
                      disabled={busy === r.id}
                      onClick={() => changeRole(r.id, "admin")}
                      className="rounded-lg gradient-cta text-primary-foreground px-3 py-1.5 text-xs font-semibold shadow-soft disabled:opacity-60"
                    >
                      Promote to Admin
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </section>
      </main>
      <FloatingAssistantButton />
    </div>
  );
}
