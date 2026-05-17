import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import logoMarkPng from "@/assets/logo-mark.png?url";
import { AuthProvider } from "@/lib/auth-context";
import { TenantSettingsProvider } from "@/lib/tenant-settings";
import { Toaster } from "@/components/ui/sonner";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Travaux — Gestão Financeira para Drywall e Masticagem" },
      { name: "description", content: "Sistema completo de gestão financeira para empresas de drywall e masticagem." },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: logoMarkPng },
      { rel: "apple-touch-icon", href: logoMarkPng },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-primary">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada</p>
        <a href="/" className="mt-4 inline-block text-primary underline">Voltar</a>
      </div>
    </div>
  ),
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantSettingsProvider>
          <Outlet />
          <Toaster richColors position="top-right" />
        </TenantSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
