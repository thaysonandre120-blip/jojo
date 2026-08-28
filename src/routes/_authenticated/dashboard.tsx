import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import AtelieApp from "@/components/atelie-erp/App.jsx";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/lib/use-is-admin";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Painel · Love, Canecas e Personalizados" },
      {
        name: "description",
        content: "Gestão de orçamentos, pedidos, clientes, precificação e relatórios do ateliê.",
      },
      { property: "og:title", content: "Painel · Love, Canecas e Personalizados" },
      {
        property: "og:description",
        content: "Gestão de orçamentos, pedidos, clientes, precificação e relatórios do ateliê.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useIsAdmin(user.id);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <AtelieApp
      userId={user.id}
      userName={(user.user_metadata?.["name"] as string) || user.email || ""}
      isAdmin={isAdmin}
      onSignOut={handleSignOut}
      onOpenAdmin={() => navigate({ to: "/admin" })}
    />
  );
}
