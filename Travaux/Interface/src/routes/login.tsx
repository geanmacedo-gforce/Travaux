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

  const onOAuth = async (provider: "google" | "apple") => {
    toast.info(t(`Login com ${provider === "google" ? "Google" : "Apple"} indisponivel nesta versao MySQL.`));
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

              <div className="grid grid-cols-2 gap-2.5 mb-5">
                <Button type="button" variant="outline" className="h-11 font-medium" onClick={()=>onOAuth("google")}>
                  <><GoogleIcon /> Google</>
                </Button>
                <Button type="button" variant="outline" className="h-11 font-medium" onClick={()=>onOAuth("apple")}>
                  <><AppleIcon /> Apple</>
                </Button>
              </div>

              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                  <span className="bg-card px-3 text-muted-foreground">{t("Ou continue com e-mail")}</span>
                </div>
              </div>

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

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
    </svg>
  );
}
