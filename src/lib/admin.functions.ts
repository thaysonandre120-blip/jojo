import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("@/lib/admin-users.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const { data: profiles } = await supabaseAdmin.from("profiles").select("id, name, email");

    return data.users.map((u) => ({
      id: u.id,
      email: u.email ?? "",
      name: profiles?.find((p) => p.id === u.id)?.name ?? "",
      role: roles?.find((r) => r.user_id === u.id)?.role ?? "user",
      disabled: Boolean(
        (u as unknown as { banned_until?: string | null }).banned_until &&
          new Date((u as unknown as { banned_until: string }).banned_until) > new Date(),
      ),
      lastSignInAt: u.last_sign_in_at ?? null,
      createdAt: u.created_at,
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(1),
        role: z.enum(["admin", "user"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, friendlyAdminError } = await import("@/lib/admin-users.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) {
      const raw = error?.message ?? "";
      throw friendlyAdminError(error, "Falha ao criar usuário.");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: created.user.id, name: data.name, email: data.email });
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: data.role }, { onConflict: "user_id,role" });

    if (profileError || roleError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw friendlyAdminError(profileError ?? roleError, "Falha ao salvar os dados do usuário.");
    }

    return { id: created.user.id };
  });

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string().min(1),
        role: z.enum(["admin", "user"]),
        password: z.string().min(8).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin, friendlyAdminError } = await import("@/lib/admin-users.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      email: data.email,
      ...(data.password ? { password: data.password } : {}),
    });
    if (error) throw friendlyAdminError(error, "Falha ao atualizar usuário.");

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: data.id, name: data.name, email: data.email });
    if (profileError) throw friendlyAdminError(profileError, "Falha ao atualizar o perfil.");

    const { error: deleteRoleError } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.id);
    if (deleteRoleError) throw friendlyAdminError(deleteRoleError, "Falha ao atualizar o acesso.");

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.id, role: data.role });
    if (roleError) throw friendlyAdminError(roleError, "Falha ao atualizar o acesso.");

    return { ok: true };
  });

export const setUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin-users.server");
    await assertAdmin(context.supabase, context.userId);
    if (data.id === context.userId) throw new Error("Você não pode desativar a própria conta.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.disabled ? "876000h" : "none",
    } as never);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ email: z.string().email(), redirectTo: z.string().url() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("@/lib/admin-users.server");
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(data.email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
