import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { UserRound, WalletCards, Settings, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/lib/i18n";

function getInitial(name?: string | null) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return "U";
  return trimmed.charAt(0).toUpperCase();
}

export function UserMenu() {
  const { user, role, profile, signOut } = useAuth();
  const { t, tEnum } = useI18n();
  const nav = useNavigate();

  const canAccessFinanceiro = role === "proprietario" || role === "admin";
  const canAccessConfiguracoes = role === "proprietario" || role === "admin";

  const avatarInitial = useMemo(() => getInitial(profile?.nome || user?.email), [profile?.nome, user?.email]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t("Menu do usuário")}
        >
          <Avatar className="h-8 w-8 border">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.nome || t("Usuário")} />
            <AvatarFallback>{avatarInitial}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 text-xs">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 border">
              <AvatarImage src={profile?.avatar_url || undefined} alt={profile?.nome || t("Usuário")} />
              <AvatarFallback>{avatarInitial}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="truncate font-normal text-xs">{profile?.nome || user?.email || t("Usuário")}</span>
              <span className="text-[11px] text-muted-foreground capitalize">{role ? tEnum(role) : "-"}</span>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem className="text-xs" onSelect={() => nav({ to: "/app/minha-conta" })}>
          <UserRound className="h-3.5 w-3.5" />
          <span className="font-normal">{t("Minha Conta")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-xs"
          onSelect={() => {
            if (!canAccessFinanceiro) {
              toast.error(t("Sem permissão para acessar Financeiro"));
              return;
            }
            nav({ to: "/app/financeiro" });
          }}
        >
          <WalletCards className="h-3.5 w-3.5" />
          <span className="font-normal">{t("Financeiro")}</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          className="text-xs"
          onSelect={() => {
            if (!canAccessConfiguracoes) {
              toast.error(t("Sem permissão para acessar Configurações"));
              return;
            }
            nav({ to: "/app/configuracoes" });
          }}
        >
          <Settings className="h-3.5 w-3.5" />
          <span className="font-normal">{t("Configurações")}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-xs"
          onSelect={async () => {
            await signOut();
            nav({ to: "/login" });
          }}
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="font-normal">{t("Sair")}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
