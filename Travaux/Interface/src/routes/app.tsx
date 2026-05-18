import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RequireAuth } from "@/components/RequireAuth";
import logoMark from "@/assets/logo-mark.png";
import { useI18n } from "@/lib/i18n";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/lib/auth-context";
import { serverLogPageAccess } from "@/lib/server-api";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { t } = useI18n();
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const lastLoggedPathRef = useRef<string>("");

  useEffect(() => {
    if (!user?.id || !user.tenant_id) return;
    if (!path.startsWith("/app")) return;
    if (lastLoggedPathRef.current === path) return;

    lastLoggedPathRef.current = path;
    void serverLogPageAccess({
      userId: user.id,
      tenantId: user.tenant_id,
      path,
    });
  }, [path, user?.id, user?.tenant_id]);

  return (
    <RequireAuth>
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col">
            <header className="h-14 flex items-center border-b bg-background px-4 gap-3">
              <SidebarTrigger />
              <div className="h-6 w-6 shrink-0">
                <img src={logoMark} alt={t("Travaux")} className="h-full w-full object-contain" />
              </div>
              <span className="font-semibold text-foreground tracking-wide">{t("Travaux")}</span>
              <div className="ml-auto">
                <UserMenu />
              </div>
            </header>
            <main className="flex-1 p-4 md:p-6 bg-muted/30">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </RequireAuth>
  );
}
