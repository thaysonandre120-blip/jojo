import type { SupabaseClient } from "@supabase/supabase-js";

export async function assertAdmin(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error || !data) throw new Error("Acesso permitido apenas para administradores.");
}

export function friendlyAdminError(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/already been registered|already exists|duplicate/i.test(raw)) {
    return new Error("Este e-mail já está cadastrado.");
  }
  if (/password/i.test(raw)) {
    return new Error("Senha inválida. Informe uma senha aceita pelo sistema.");
  }
  return new Error(raw || fallback);
}