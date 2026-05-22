import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { serverCreateUser } from "@/lib/server-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Mail, Lock, ArrowLeft, UserPlus } from "lucide-react";
import heroImg from "@/assets/hero-drywall.jpg";
import logoHorizontal from "@/assets/logo-horizontal.png";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { signIn, user } = useAuth();
  const { t, isEnglish } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [forgot, setForgot] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const emptyCreateForm = { tenantCode: "", nome: "", email: "", password: "", confirmPassword: "", role: "funcionario" };
  const [createForm, setCreateForm] = useState({
    tenantCode: "",
    nome: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "funcionario",
  });

  if (user) {
    nav({ to: user.must_change_password ? "/reset-password" : "/app" });
    return null;
  }

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const result = await signIn(email.trim().toLowerCase(), password);
    setBusy(false);
    if (result.error) {
      toast.error(traduzErro(result.error));
      return;
    }

    if (result.mustChangePassword) {
      toast.info(t("Você precisa redefinir sua senha antes de continuar."));
      nav({ to: "/reset-password" });
    } else {
      toast.success(t("Bem-vindo!"));
      nav({ to: "/app" });
    }
  };

  const onForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    toast.info(t("Recuperacao de senha disponivel na tela de Usuarios (redefinir senha). Contate o administrador."));
    setForgot(false);
    setResetEmail("");
  };

  const onCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!createForm.tenantCode.trim() || !createForm.nome.trim() || !createForm.email.trim() || !createForm.password.trim()) {
      toast.error(t("Preencha codigo da empresa, nome, e-mail e senha."));
      return;
    }

    if (createForm.password.length < 6) {
      toast.error(t("A senha deve ter no minimo 6 caracteres."));
      return;
    }

    if (createForm.password !== createForm.confirmPassword) {
      toast.error(t("As senhas não coincidem."));
      return;
    }

    setCreateBusy(true);
    try {
      const result = await serverCreateUser({
        tenantCode: createForm.tenantCode.trim(),
        nome: createForm.nome.trim(),
        email: createForm.email.trim().toLowerCase(),
        password: createForm.password,
        role: createForm.role,
      });

      const createdUser = (result as any)?.user as { id?: string; email?: string; ativo?: boolean } | undefined;
      if (!createdUser?.id || !createdUser?.email) {
        throw new Error(t("Falha ao confirmar criacao do usuario na tabela users."));
      }

      if (createdUser.ativo === false) {
        toast.success(t("Usuário criado com sucesso. O acesso ficará pendente até aprovação de Proprietário ou Administrador."));
      } else {
        toast.success(t("Usuário criado como Proprietário com acesso liberado."));
      }
      setCreateOpen(false);
      setCreateForm(emptyCreateForm);
    } catch (error) {
      toast.error((error as Error).message || t("Falha ao criar usuario"));
    } finally {
      setCreateBusy(false);
    }
  };

  return (
    <div className="min-h-screen relative grid place-items-center p-4">
      <img src={heroImg} alt={isEnglish ? "Travaux team at a drywall construction site" : "Equipe Travaux em obra de drywall"} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-br from-secondary/90 via-secondary/75 to-primary/55" />

      <div className="relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link to="/" className="mb-6 flex justify-center">
          <img
            src={logoHorizontal}
            alt="Logo Travaux"
            className="h-16 w-auto rounded-md shadow-lg shadow-black/40"
          />
        </Link>

        <div className="rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl p-7">
          {forgot ? (
            <>
              <button type="button" onClick={()=>setForgot(false)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors">
                <ArrowLeft className="h-4 w-4" /> {t("Voltar")}
              </button>
              <h2 className="text-2xl font-bold mb-1">{t("Recuperar senha")}</h2>
              <p className="text-sm text-muted-foreground mb-5">{t("Enviaremos um link para redefinir sua senha.")}</p>
              <form onSubmit={onForgot} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("E-mail")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" required value={resetEmail} onChange={(e)=>setResetEmail(e.target.value)} className="pl-9" placeholder={isEnglish ? "you@company.com" : "voce@empresa.com"} />
                  </div>
                </div>
                <Button className="w-full h-11" disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Enviar link de recuperação")}</Button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-1">{t("Entrar")}</h2>
              <p className="text-sm text-muted-foreground mb-5">{t("Acesse sua conta Travaux")}</p>

              <form onSubmit={onSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("E-mail")}</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9" placeholder={isEnglish ? "you@company.com" : "voce@empresa.com"} autoComplete="email" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label>{t("Senha")}</Label>
                    <button type="button" onClick={()=>setForgot(true)} className="text-xs text-primary hover:underline font-medium">{t("Esqueci minha senha")}</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9" placeholder="••••••••" autoComplete="current-password" />
                  </div>
                </div>
                <Button className="w-full h-11 font-semibold" disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("Entrar")}
                </Button>
              </form>

              <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (o) setCreateForm(emptyCreateForm); }}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline" className="w-full mt-3 h-11 font-medium">
                    <UserPlus className="h-4 w-4 mr-2" /> {t("Criar usuario")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md rounded-2xl border-white/10 bg-card/95 backdrop-blur-xl">
                  <DialogHeader>
                    <DialogTitle>{t("Criar novo usuario")}</DialogTitle>
                    <DialogDescription>
                      {t("Informe o codigo da empresa para criar um novo acesso vinculado ao tenant correto.")}
                    </DialogDescription>
                  </DialogHeader>

                  <form onSubmit={onCreateUser} className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>{t("Codigo da empresa")}</Label>
                      <Input
                        value={createForm.tenantCode}
                        onChange={(e) => setCreateForm({ ...createForm, tenantCode: e.target.value })}
                        placeholder="ex: TRV001"
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("Nome")}</Label>
                      <Input
                        value={createForm.nome}
                        onChange={(e) => setCreateForm({ ...createForm, nome: e.target.value })}
                        placeholder={isEnglish ? "Full name" : "Nome completo"}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("E-mail")}</Label>
                      <Input
                        type="email"
                        value={createForm.email}
                        onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                        placeholder={isEnglish ? "you@company.com" : "voce@empresa.com"}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("Senha")}</Label>
                      <Input
                        type="password"
                        value={createForm.password}
                        onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                        placeholder={t("Minimo 6 caracteres")}
                        minLength={6}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("Confirmar senha")}</Label>
                      <Input
                        type="password"
                        value={createForm.confirmPassword}
                        onChange={(e) => setCreateForm({ ...createForm, confirmPassword: e.target.value })}
                        placeholder={isEnglish ? "Repeat the password" : "Repita a senha"}
                        minLength={6}
                        required
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label>{t("Perfil")}</Label>
                      <Select value={createForm.role} onValueChange={(v) => setCreateForm({ ...createForm, role: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">{t("Administrador")}</SelectItem>
                          <SelectItem value="gerente">{t("Gerente")}</SelectItem>
                          <SelectItem value="funcionario">{t("Funcionário")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <DialogFooter className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateOpen(false)}
                        disabled={createBusy}
                      >
                        {t("Cancelar")}
                      </Button>
                      <Button type="submit" disabled={createBusy}>
                        {createBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (isEnglish ? "Create login" : "Criar login")}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>

              <p className="text-[11px] text-muted-foreground text-center mt-5 leading-relaxed">
                {isEnglish ? "Restricted access. Only users registered by the Owner or Administrator can sign in." : "Acesso restrito. Apenas usuários cadastrados pelo Proprietário ou Administrador podem entrar."}
              </p>
            </>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-white/85 italic tracking-wide">{isEnglish ? '"Always available for construction."' : '"Sempre disponível para a construção."'}</p>
      </div>
    </div>
  );
}

function traduzErro(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return "E-mail ou senha inválidos.";
  if (/Email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  return msg;
}
