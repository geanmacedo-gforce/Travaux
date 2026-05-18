import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Building2,
  Users,
  HardHat,
  Package,
  Receipt,
  Wallet,
  BarChart3,
  UserCog,
  Clock,
  CircleDollarSign,
  ChevronDown,
} from "lucide-react";
import { useAuth, type AppRole } from "@/lib/auth-context";
import { serverQueryOne } from "@/lib/server-api";
import logoMark from "@/assets/logo-mark.png";
import { useI18n } from "@/lib/i18n";

type MenuItem = {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
};
type MenuGroup = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: AppRole[];
  items: MenuItem[];
};
type MenuItemOrGroup = MenuItem | MenuGroup;

const isGroup = (item: MenuItemOrGroup): item is MenuGroup => "items" in item;

const items: MenuItemOrGroup[] = [
  {
    title: "Dashboard",
    url: "/app",
    icon: LayoutDashboard,
    roles: ["proprietario", "admin", "gerente", "funcionario"],
  },
  {
    title: "Funcionários",
    icon: HardHat,
    roles: ["proprietario", "admin", "gerente"],
    items: [
      {
        title: "Cadastro",
        url: "/app/funcionarios",
        icon: HardHat,
        roles: ["proprietario", "admin", "gerente"],
      },
      {
        title: "Registro de Ponto",
        url: "/app/registro-pontos",
        icon: Clock,
        roles: ["proprietario", "admin", "gerente"],
      },
      {
        title: "Folha de Pagamento",
        url: "/app/folha",
        icon: Wallet,
        roles: ["proprietario", "admin", "gerente"],
      },
    ],
  },
  {
    title: "Obras",
    icon: Building2,
    roles: ["proprietario", "admin", "gerente"],
    items: [
      {
        title: "Clientes",
        url: "/app/clientes",
        icon: Users,
        roles: ["proprietario", "admin", "gerente"],
      },
      {
        title: "Cadastro Obras",
        url: "/app/obras",
        icon: Building2,
        roles: ["proprietario", "admin", "gerente"],
      },
      {
        title: "Produtos e Insumos",
        url: "/app/produtos",
        icon: Package,
        roles: ["proprietario", "admin", "gerente"],
      },
      {
        title: "Despesas",
        url: "/app/despesas",
        icon: Receipt,
        roles: ["proprietario", "admin", "gerente"],
      },
      {
        title: "Pagamentos Recebidos",
        url: "/app/pagamentos-recebidos",
        icon: Wallet,
        roles: ["proprietario", "admin", "gerente"],
      },
    ],
  },
  {
    title: "Relatórios",
    url: "/app/relatorios",
    icon: BarChart3,
    roles: ["proprietario", "admin", "gerente"],
  },
  { title: "Usuários", url: "/app/usuarios", icon: UserCog, roles: ["proprietario", "admin"] },
  { title: "Minhas Horas", url: "/app/minhas-horas", icon: Clock, roles: ["funcionario"] },
  {
    title: "Meus Pagamentos",
    url: "/app/meus-pagamentos",
    icon: CircleDollarSign,
    roles: ["funcionario"],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { role, user } = useAuth();
  const tenantId = user?.tenant_id ?? "";
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const { t } = useI18n();

  const { data: tenant } = useQuery({
    queryKey: ["sidebar-tenant", tenantId],
    queryFn: async () =>
      await serverQueryOne<{ nome: string }>({
        sql: "SELECT nome FROM tenants WHERE id = ? LIMIT 1",
        values: [tenantId],
      }),
    enabled: Boolean(tenantId),
  });

  const companyName = tenant?.nome ?? t("Travaux");

  if (!role) return null;

  const visible = items.filter((item) =>
    isGroup(item) ? item.roles.includes(role) : item.roles.includes(role),
  );

  const isActive = (url: string) => (url === "/app" ? path === "/app" : path.startsWith(url));

  const toggleGroup = (groupTitle: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupTitle)) {
      newExpanded.delete(groupTitle);
    } else {
      newExpanded.add(groupTitle);
    }
    setExpandedGroups(newExpanded);
  };

  const isGroupActive = (group: MenuGroup) => {
    return group.items.some((item) => isActive(item.url));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={`border-b border-sidebar-border ${collapsed ? "p-2" : "p-4"}`}>
        <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"}`}>
          <div className="h-5 w-5 shrink-0">
            <img src={logoMark} alt="Travaux" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div>
              <div className="text-xs font-normal text-sidebar-foreground truncate">
                {companyName}
              </div>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{t("Menu")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                if (isGroup(item)) {
                  const expanded = expandedGroups.has(item.title);
                  const active = isGroupActive(item);

                  return (
                    <div key={item.title}>
                      <SidebarMenuItem>
                        <button
                          onClick={() => !collapsed && toggleGroup(item.title)}
                          className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${active ? "bg-sidebar-accent/80 text-sidebar-accent-foreground" : ""}`}
                        >
                          <item.icon className="h-4 w-4" />
                          {!collapsed && (
                            <>
                              <span className="flex-1 text-left">{t(item.title)}</span>
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  expanded ? "rotate-0" : "-rotate-90"
                                }`}
                              />
                            </>
                          )}
                        </button>
                      </SidebarMenuItem>
                      {!collapsed && expanded && (
                        <div className="ml-6 space-y-1 mt-1">
                          {item.items.map((subitem) => (
                            <SidebarMenuItem key={subitem.url}>
                              <SidebarMenuButton asChild isActive={isActive(subitem.url)}>
                                <Link to={subitem.url} className="flex items-center gap-2 text-sm">
                                  <subitem.icon className="h-4 w-4" />
                                  <span>{t(subitem.title)}</span>
                                </Link>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                } else {
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton asChild isActive={isActive(item.url)}>
                        <Link to={item.url} className="flex items-center gap-2">
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span>{t(item.title)}</span>}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className={`border-t border-sidebar-border ${collapsed ? "p-2" : "p-3"}`}>
        <a
          href="https://www.gforcedata.com.br"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-[11px] text-sidebar-foreground/75 hover:text-sidebar-foreground transition-colors"
          title="Powered by Gforce Data Solutions"
        >
          {collapsed ? "Gforce" : "Powered by Gforce Data Solutions"}
        </a>
      </SidebarFooter>
    </Sidebar>
  );
}
