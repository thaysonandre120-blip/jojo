import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha · Love, Canecas e Personalizados" },
      { name: "description", content: "Defina uma nova senha para acessar o sistema do ateliê." },
      { property: "og:title", content: "Redefinir senha · Love, Canecas e Personalizados" },
      {
        property: "og:description",
        content: "Defina uma nova senha para acessar o sistema do ateliê.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError("Não foi possível redefinir a senha. Solicite um novo link.");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl border border-slate-100 p-6"
      >
        <h1 className="text-lg font-semibold text-slate-800">Definir nova senha</h1>
        <label className="block text-xs font-medium text-slate-500 mt-5 mb-1.5">Nova senha</label>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
        />
        {error && <p className="text-xs text-rose-600 mt-3">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-5 w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: "#C1577A" }}
        >
          {loading ? "Salvando…" : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}
