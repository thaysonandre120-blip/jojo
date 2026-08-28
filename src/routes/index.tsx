import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getUser();
    throw redirect({ to: data.user ? "/dashboard" : "/auth", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Love, Canecas e Personalizados · Gestão do Ateliê" },
      {
        name: "description",
        content: "Sistema privado de gestão do ateliê Love, Canecas e Personalizados.",
      },
      { property: "og:title", content: "Love, Canecas e Personalizados · Gestão do Ateliê" },
      {
        property: "og:description",
        content: "Sistema privado de gestão do ateliê Love, Canecas e Personalizados.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => null,
});
