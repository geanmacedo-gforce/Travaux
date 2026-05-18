import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { serverChangeUserRole, serverCreateUser, serverQuery, serverResetUserPassword } from "@/lib/server-api";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, ConfirmDelete } from "@/components/crud";
import { Navigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useState } from "react";
import { UserPlus, KeyRound, Copy } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/usuarios")({ component: Page });

function Page() {
  const { role, user } = useAuth();
  const { t, tEnum, isEnglish } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const emptyForm = { nome: "", email: "", password: "", confirmPassword: "", role: "admin", funcionario_id: "" };
  const [form, setForm] = useState(emptyForm);
  const [reset, setReset] = useState<{ open: boolean; nome: string; email: string; password: string }>({ open: false, nome: "", email: "", password: "" });
  const [resetConfirm, setResetConfirm] = useState<{ open: boolean; userId: string; nome: string; email: string; actorPassword: string; busy: boolean }>({
    open: false,
    userId: "",
    nome: "",
    email: "",
    actorPassword: "",
    busy: false,
  });
  const [busy, setBusy] = useState(false);

  if (role && role !== "proprietario" && role !== "admin") return <Navigate to="/app" />;

  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-all", tenantId],
    queryFn: async () => (await serverQuery({ sql: "SELECT id, user_id, nome, email, funcionario_id, ativo FROM profiles WHERE tenant_id = ? ORDER BY nome", values: [tenantId] })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["roles-all", tenantId],
    queryFn: async () => (await serverQuery({ sql: "SELECT user_id, role FROM user_roles WHERE tenant_id = ?", values: [tenantId] })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: funcs = [] } = useQuery({
    queryKey: ["funcs-link", tenantId],
    queryFn: async () => (await serverQuery({ sql: "SELECT id, nome FROM funcionarios WHERE tenant_id = ? ORDER BY nome", values: [tenantId] })) ?? [],
    enabled: Boolean(tenantId),
  });

  const changeRole = async (uid: string, newRole: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverChangeUserRole({ userId: uid, role: newRole, tenantId });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Perfil atualizado")); qc.invalidateQueries({ queryKey: ["roles-all"] });
  };

  const linkFunc = async (uid: string, fid: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "UPDATE profiles SET funcionario_id = ? WHERE user_id = ? AND tenant_id = ?",
        values: [fid || null, uid, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Vínculo atualizado")); qc.invalidateQueries({ queryKey: ["profiles-all"] });
  };

  const createUser = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    if (!form.nome || !form.email || !form.password) return toast.error(t("Preencha nome, e-mail e senha"));
    if (form.password !== form.confirmPassword) return toast.error(t("As senhas não coincidem."));
    setBusy(true);
    try {
      await serverCreateUser({
        nome: form.nome,
        email: form.email,
        password: form.password,
        role: form.role,
        funcionario_id: form.funcionario_id || undefined,
        tenantId,
      });
    } catch (error) {
      setBusy(false);
      return toast.error((error as Error).message ?? (isEnglish ? "Failure" : "Falha"));
    }
    setBusy(false);
    toast.success(t("Usuário criado"));
    setOpen(false);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["profiles-all"] });
    qc.invalidateQueries({ queryKey: ["roles-all"] });
  };

  const toggleActive = async (uid: string, active: boolean) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await Promise.all([
        serverQuery({
          sql: "UPDATE users SET ativo = ? WHERE id = ? AND tenant_id = ?",
          values: [active, uid, tenantId],
        }),
        serverQuery({
          sql: "UPDATE profiles SET ativo = ? WHERE user_id = ? AND tenant_id = ?",
          values: [active, uid, tenantId],
        }),
      ]);
    } catch (error) {
      return toast.error((error as Error).message ?? (isEnglish ? "Failure" : "Falha"));
    }
    toast.success(active ? t("Usuário ativado") : t("Usuário desativado"));
    qc.invalidateQueries({ queryKey: ["profiles-all"] });
  };

  const openResetPasswordConfirm = (uid: string, nome: string, email: string) => {
    setResetConfirm({
      open: true,
      userId: uid,
      nome,
      email,
      actorPassword: "",
      busy: false,
    });
  };

  const resetPassword = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    if (!user?.id) return toast.error(t("Usuário autenticado não encontrado."));
    if (!resetConfirm.actorPassword) return toast.error(t("Informe sua senha atual para continuar."));
    try {
      setResetConfirm((prev) => ({ ...prev, busy: true }));
      const data = await serverResetUserPassword({
        userId: resetConfirm.userId,
        tenantId,
        actorUserId: user.id,
        actorPassword: resetConfirm.actorPassword,
      });
      setReset({ open: true, nome: resetConfirm.nome, email: resetConfirm.email, password: data.password });
      setResetConfirm({ open: false, userId: "", nome: "", email: "", actorPassword: "", busy: false });
    } catch (error) {
      setResetConfirm((prev) => ({ ...prev, busy: false }));
      return toast.error((error as Error).message ?? (isEnglish ? "Failure" : "Falha"));
    }
  };

  const deleteUser = async (uid: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    if (uid === user?.id) return toast.error(t("Você não pode excluir o próprio usuário."));
    try {
      await Promise.all([
        serverQuery({
          sql: "DELETE FROM user_roles WHERE user_id = ? AND tenant_id = ?",
          values: [uid, tenantId],
        }),
        serverQuery({
          sql: "DELETE FROM profiles WHERE user_id = ? AND tenant_id = ?",
          values: [uid, tenantId],
        }),
      ]);
      await serverQuery({
        sql: "DELETE FROM users WHERE id = ? AND tenant_id = ?",
        values: [uid, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message ?? (isEnglish ? "Failure" : "Falha"));
    }
    toast.success(t("Usuário excluído"));
    qc.invalidateQueries({ queryKey: ["profiles-all"] });
    qc.invalidateQueries({ queryKey: ["roles-all"] });
  };

  return (
    <div>
      <PageHeader title="Usuários do Sistema" action={
        <Dialog open={open} onOpenChange={(o)=>{ setOpen(o); if (o) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="h-4 w-4 mr-2" />{t("Adicionar usuário")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("Novo usuário")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("Nome")}</Label><Input value={form.nome} onChange={(e)=>setForm({...form, nome:e.target.value})} /></div>
              <div><Label>{t("E-mail")}</Label><Input type="email" value={form.email} onChange={(e)=>setForm({...form, email:e.target.value})} /></div>
              <div><Label>{t("Senha provisória")}</Label><Input type="text" minLength={6} value={form.password} onChange={(e)=>setForm({...form, password:e.target.value})} /></div>
              <div><Label>{t("Confirmar senha")}</Label><Input type="text" minLength={6} value={form.confirmPassword} onChange={(e)=>setForm({...form, confirmPassword:e.target.value})} /></div>
              <div>
                <Label>{t("Perfil")}</Label>
                <Select value={form.role} onValueChange={(v)=>setForm({...form, role:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">{t("Administrador")}</SelectItem>
                    <SelectItem value="gerente">{t("Gerente")}</SelectItem>
                    <SelectItem value="funcionario">{t("Funcionário")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("Vincular a funcionário (opcional)")}</Label>
                <Select value={form.funcionario_id} onValueChange={(v)=>setForm({...form, funcionario_id:v})}>
                  <SelectTrigger><SelectValue placeholder="-"/></SelectTrigger>
                  <SelectContent>{funcs.map((f:any)=><SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={()=>setOpen(false)}>{t("Cancelar")}</Button>
              <Button onClick={createUser} disabled={busy}>{busy ? t("Criando…") : t("Criar")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <p className="text-sm text-muted-foreground mb-3">{t("Apenas Proprietário e Administrador podem adicionar novos usuários.")}</p>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Nome")}</TableHead><TableHead>{t("E-mail")}</TableHead><TableHead>{t("Perfil")}</TableHead><TableHead>{t("Funcionário vinculado")}</TableHead><TableHead className="w-32 whitespace-nowrap">{t("Ativo")}</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
          <TableBody>
            {profiles.map((p:any)=>{
              const uid = p.user_id ?? p.id;
              const r = roles.find((x:any)=>x.user_id===uid);
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.email}</TableCell>
                  <TableCell>
                    <Select value={r?.role ?? "funcionario"} onValueChange={(v)=>changeRole(uid, v)}>
                      <SelectTrigger className="w-44"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="proprietario">{t("Proprietário")}</SelectItem><SelectItem value="admin">{t("Administrador")}</SelectItem><SelectItem value="gerente">{t("Gerente")}</SelectItem><SelectItem value="funcionario">{t("Funcionário")}</SelectItem></SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={p.funcionario_id ?? ""} onValueChange={(v)=>linkFunc(uid, v)}>
                      <SelectTrigger className="w-56"><SelectValue placeholder="-"/></SelectTrigger>
                      <SelectContent>{funcs.map((f:any)=><SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="w-32">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={Boolean(p.ativo)}
                        onCheckedChange={(checked) => toggleActive(uid, checked)}
                        className="data-[state=checked]:bg-emerald-500 data-[state=unchecked]:bg-slate-300"
                        aria-label={p.ativo ? t("Desativar usuário") : t("Ativar usuário")}
                      />
                      <span className={p.ativo ? "min-w-16 text-xs text-emerald-600" : "min-w-16 text-xs text-slate-500"}>{p.ativo ? t("Ativo") : t("Pendente")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="ghost" onClick={()=>openResetPasswordConfirm(uid, p.nome, p.email)} aria-label={t("Redefinir senha")}> 
                            <KeyRound className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{t("Redefinir senha")}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <ConfirmDelete onConfirm={() => deleteUser(uid)} label="Excluir usuário" />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={reset.open} onOpenChange={(o)=>setReset({...reset, open:o})}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Nova senha provisória")}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{t("Senha redefinida para {name} ({email}). Copie e envie ao usuário — ela não será exibida novamente.", { name: reset.nome, email: reset.email })}</p>
            <div className="flex gap-2">
              <Input readOnly value={reset.password} className="font-mono" />
              <Button type="button" variant="outline" onClick={()=>{ navigator.clipboard.writeText(reset.password); toast.success(t("Senha copiada")); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={()=>setReset({...reset, open:false})}>{t("Fechar")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resetConfirm.open} onOpenChange={(o)=>setResetConfirm((prev)=>({ ...prev, open: o }))}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("Confirmar redefinição de senha")}</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p>{t("Para redefinir a senha de {name} ({email}), informe sua senha atual.", { name: resetConfirm.nome, email: resetConfirm.email })}</p>
            <div>
              <Label>{t("Sua senha atual")}</Label>
              <Input
                type="password"
                value={resetConfirm.actorPassword}
                onChange={(e)=>setResetConfirm((prev)=>({ ...prev, actorPassword: e.target.value }))}
                autoComplete="current-password"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={()=>setResetConfirm({ open: false, userId: "", nome: "", email: "", actorPassword: "", busy: false })}
              disabled={resetConfirm.busy}
            >
              {t("Cancelar")}
            </Button>
            <Button onClick={resetPassword} disabled={resetConfirm.busy}>
              {resetConfirm.busy ? t("Validando…") : t("Confirmar")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
