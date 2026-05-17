import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { RequireAuth } from "@/components/RequireAuth";
import logoMark from "@/assets/logo-mark.png";
import { useI18n } from "@/lib/i18n";
import { UserMenu } from "@/components/UserMenu";

export const Route = createFileRoute("/app")({ component: AppLayout });

function AppLayout() {
  const { t } = useI18n();
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
