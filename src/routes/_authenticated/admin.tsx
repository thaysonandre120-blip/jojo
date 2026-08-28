import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Search, UserPlus } from "lucide-react";
import {
  listUsers,
  createUser,
  updateUser,
  setUserDisabled,
  sendPasswordReset,
} from "@/lib/admin.functions";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Usuários · Administração do Ateliê" },
      {
        name: "description",
        content: "Área administrativa para criar, editar e desativar usuários do sistema.",
      },
      { property: "og:title", content: "Usuários · Administração do Ateliê" },
      {
        property: "og:description",
        content: "Gerencie contas, papéis e acessos do sistema de gestão do ateliê.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

type FormState = {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
};

const emptyForm: FormState = { name: "", email: "", password: "", role: "user" };

function AdminPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin(user.id);

  const fetchUsers = useServerFn(listUsers);
  const createFn = useServerFn(createUser);
  const updateFn = useServerFn(updateUser);
  const disableFn = useServerFn(setUserDisabled);
  const resetFn = useServerFn(sendPasswordReset);

  const [form, setForm] = useState<FormState>(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const usersQuery = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: () => fetchUsers({ data: undefined as never }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-users"] });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      if (!f.name.trim()) throw new Error("Informe o nome do usuário.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))
        throw new Error("Informe um e-mail válido.");
      if (!f.id && f.password.length < 8)
        throw new Error("A senha precisa ter pelo menos 8 caracteres.");
      if (f.id && f.password && f.password.length < 8)
        throw new Error("A nova senha precisa ter pelo menos 8 caracteres.");
      if (f.id) {
        return updateFn({
          data: {
            id: f.id,
            name: f.name,
            email: f.email,
            role: f.role,
            ...(f.password ? { password: f.password } : {}),
          },
        });
      }
      return createFn({
        data: { name: f.name, email: f.email, password: f.password, role: f.role },
      });
    },
    onSuccess: () => {
      setMsg("Usuário salvo com sucesso.");
      setErr(null);
      setForm(emptyForm);
      setShowForm(false);
      refresh();
    },
    onError: (e: Error) => {
      setErr(e.message);
      setMsg(null);
    },
  });

  const toggleDisabled = useMutation({
    mutationFn: (v: { id: string; disabled: boolean }) => disableFn({ data: v }),
    onSuccess: () => {
      setErr(null);
      refresh();
    },
    onError: (e: Error) => setErr(e.message),
  });

  const reset = useMutation({
    mutationFn: (email: string) =>
      resetFn({ data: { email, redirectTo: `${window.location.origin}/reset-password` } }),
    onSuccess: () => {
      setErr(null);
      setMsg("E-mail de redefinição de senha enviado.");
    },
    onError: (e: Error) => setErr(e.message),
  });

  const filteredUsers = (usersQuery.data ?? []).filter((listedUser) => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    if (!query) return true;
    return `${listedUser.name} ${listedUser.email} ${listedUser.role}`
      .toLocaleLowerCase("pt-BR")
      .includes(query);
  });

  if (!isAdmin) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="text-center">
          <h1 className="text-lg font-semibold text-slate-800">Acesso restrito</h1>
          <p className="text-sm text-slate-500 mt-1">
            Esta área é exclusiva para administradores.
          </p>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="mt-5 rounded-xl px-4 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#C1577A" }}
          >
            Voltar ao painel
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">Gerenciar usuários</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Crie, edite, desative contas e envie links de redefinição de senha.
            </p>
          </div>
          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Voltar ao painel
          </button>
        </div>

        {msg && <p className="text-xs text-emerald-600">{msg}</p>}
        {err && <p className="text-xs text-rose-600">{err}</p>}

        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-sm">
            <span className="sr-only">Buscar usuários</span>
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome, e-mail ou papel"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none focus:border-rose-300"
            />
          </label>
          <button
            onClick={() => {
              setForm(emptyForm);
              setShowForm((s) => !s);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#C1577A" }}
          >
            <UserPlus className="size-4" />
            {showForm ? "Cancelar" : "Novo usuário"}
          </button>
        </div>

        {showForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(form);
            }}
            className="bg-white rounded-2xl border border-slate-100 p-5 grid sm:grid-cols-2 gap-4"
          >
            <label className="text-xs font-medium text-slate-500">
              Nome
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none"
              />
            </label>
            <label className="text-xs font-medium text-slate-500">
              E-mail
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none"
              />
            </label>
            <label className="text-xs font-medium text-slate-500">
              {form.id ? "Nova senha (opcional)" : "Senha"}
              <input
                type="password"
                required={!form.id}
                minLength={8}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none"
              />
            </label>
            <label className="text-xs font-medium text-slate-500">
              Papel
              <select
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value as "admin" | "user" }))
                }
                className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none"
              >
                <option value="user">Usuária</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={save.isPending}
                className="rounded-xl px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: "#C1577A" }}
              >
                {save.isPending ? "Salvando…" : "Salvar usuário"}
              </button>
            </div>
          </form>
        )}

        <div className="bg-white rounded-2xl border border-slate-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 border-b border-slate-100">
              <tr>
                <th className="px-5 py-3 font-medium">Nome</th>
                <th className="px-5 py-3 font-medium">E-mail</th>
                <th className="px-5 py-3 font-medium">Papel</th>
                <th className="px-5 py-3 font-medium">Situação</th>
                <th className="px-5 py-3 font-medium text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3.5 text-slate-700">{u.name || "—"}</td>
                  <td className="px-5 py-3.5 text-slate-500">{u.email}</td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {u.role === "admin" ? "Administrador" : "Usuária"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`text-xs px-2 py-1 rounded-lg ${
                        u.disabled ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"
                      }`}
                    >
                      {u.disabled ? "Desativado" : "Ativo"}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-3">
                    <button
                      onClick={() => {
                        setForm({
                          id: u.id,
                          name: u.name,
                          email: u.email,
                          password: "",
                          role: u.role as "admin" | "user",
                        });
                        setShowForm(true);
                      }}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => reset.mutate(u.email)}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Redefinir senha
                    </button>
                    <button
                      onClick={() => toggleDisabled.mutate({ id: u.id, disabled: !u.disabled })}
                      className="text-xs text-rose-500 hover:text-rose-700"
                    >
                      {u.disabled ? "Reativar" : "Desativar"}
                    </button>
                  </td>
                </tr>
              ))}
              {usersQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-xs">
                    Carregando usuários…
                  </td>
                </tr>
              )}
              {usersQuery.isError && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-rose-600 text-xs">
                    Não foi possível carregar os usuários. Tente novamente.
                  </td>
                </tr>
              )}
              {!usersQuery.isLoading && !usersQuery.isError && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 text-xs">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
