import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Lock } from "lucide-react";
import heroImg from "@/assets/hero-drywall.jpg";
import { useAuth } from "@/lib/auth-context";
import { serverChangeOwnPassword } from "@/lib/server-api";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/reset-password")({ component: ResetPage });

function ResetPage() {
  const nav = useNavigate();
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error(t("Faça login para redefinir sua senha."));
      nav({ to: "/login" });
      return;
    }
    if (password.length < 6) return toast.error(t("A senha precisa ter ao menos 6 caracteres."));
    if (password !== confirm) return toast.error(t("As senhas não coincidem."));
    setBusy(true);
    try {
      await serverChangeOwnPassword({ userId: user.id, tenantId: user.tenant_id, password });
    } catch (error) {
      setBusy(false);
      return toast.error((error as Error).message || (t("Falha ao redefinir senha") || "Falha ao redefinir senha"));
    }
    setBusy(false);
    toast.success(t("Senha redefinida com sucesso. Faça login novamente."));
    await signOut();
    nav({ to: "/login" });
  };

  return (
    <div className="min-h-screen relative grid place-items-center p-4">
      <img src={heroImg} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/90 via-secondary/75 to-primary/55" />
      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl p-7">
          <h2 className="text-2xl font-bold mb-1">{t("Redefinir senha")}</h2>
          <p className="text-sm text-muted-foreground mb-5">{t("Defina sua própria senha para liberar o acesso ao sistema.")}</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("Nova senha")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" required value={password} onChange={(e)=>setPassword(e.target.value)} className="pl-9" minLength={6} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>{t("Confirmar nova senha")}</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="password" required value={confirm} onChange={(e)=>setConfirm(e.target.value)} className="pl-9" minLength={6} />
              </div>
            </div>
            <Button className="w-full h-11" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Salvar nova senha")}</Button>
          </form>
        </div>
      </div>
    </div>
  );
}
