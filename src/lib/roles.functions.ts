import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Owner-only: list all users with their roles
export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Verify caller is owner
    const { data: mine } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isOwner = (mine ?? []).some((r) => r.role === "owner");
    if (!isOwner) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const { data: rolesRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rErr) throw new Error(rErr.message);

    const byUser = new Map<string, string[]>();
    for (const r of rolesRows ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    }

    return users.users.map((u) => {
      const roles = byUser.get(u.id) ?? [];
      const effective = roles.includes("owner")
        ? "owner"
        : roles.includes("admin")
        ? "admin"
        : "user";
      return {
        id: u.id,
        email: u.email ?? "",
        created_at: u.created_at,
        role: effective as "owner" | "admin" | "user",
      };
    });
  });

// Owner-only: set a user's role (promote/demote between admin and user)
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "user"]),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verify caller is owner
    const { data: mine } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isOwner = (mine ?? []).some((r) => r.role === "owner");
    if (!isOwner) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Never touch owner rows
    const { data: existing } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const targetIsOwner = (existing ?? []).some((r) => r.role === "owner");
    if (targetIsOwner) throw new Response("Cannot modify owner", { status: 403 });

    // Remove non-owner roles then insert desired
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .in("role", ["admin", "user"]);
    if (delErr) throw new Error(delErr.message);

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (insErr) throw new Error(insErr.message);

    return { ok: true };
  });
