import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Entrar · Love, Canecas e Personalizados" },
      {
        name: "description",
        content: "Acesso restrito ao sistema de gestão do ateliê Love, Canecas e Personalizados.",
      },
      { property: "og:title", content: "Entrar · Love, Canecas e Personalizados" },
      {
        property: "og:description",
        content: "Área privada de gestão do ateliê. Acesso somente para usuários autorizados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("E-mail ou senha inválidos, ou conta desativada.");
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  };

  const forgot = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("Digite seu e-mail para receber o link de redefinição.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) setError("Não foi possível enviar o e-mail agora.");
    else setInfo("Se este e-mail estiver cadastrado, você receberá o link de redefinição.");
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8 leading-none">
          <p className="font-serif font-bold text-4xl tracking-tight" style={{ color: "#C1577A" }}>
            Love
          </p>
          <p className="text-xs font-medium text-slate-400 tracking-wide mt-1">
            Canecas e personalizados
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h1 className="text-lg font-semibold text-slate-800">Entrar no sistema</h1>
          <p className="text-xs text-slate-400 mt-1">
            Acesso restrito. As contas são criadas pelo administrador.
          </p>

          <form onSubmit={submit} className="space-y-4 mt-5">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">E-mail</label>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Senha</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-300"
              />
            </div>

            {error && <p className="text-xs text-rose-600">{error}</p>}
            {info && <p className="text-xs text-emerald-600">{info}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: "#C1577A" }}
            >
              {loading ? "Entrando…" : "Entrar"}
            </button>
          </form>

          <button
            onClick={forgot}
            className="mt-4 text-xs text-slate-400 hover:text-slate-600 w-full text-center"
          >
            Esqueci minha senha
          </button>
        </div>
      </div>
    </main>
  );
}
