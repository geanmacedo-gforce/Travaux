import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { serverQuery } from "@/lib/server-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, SearchBar, FormDialog, ConfirmDelete, NewButton } from "@/components/crud";
import { maskCPFCNPJ, maskPhone, maskCEP } from "@/lib/format";
import { toast } from "sonner";
import { Archive, Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/clientes")({ component: ClientesPage });

const empty = { nome:"", documento:"", telefone:"", email:"", rua:"", numero:"", bairro:"", cidade:"", estado:"", cep:"", observacoes:"" };

function ClientesPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["clientes", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT * FROM clientes WHERE tenant_id = ? ORDER BY nome",
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });

  const filtered = rows.filter((r: any) => r.nome.toLowerCase().includes(q.toLowerCase()) || (r.documento ?? "").includes(q));

  const openNew = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => { setEdit(r); setForm({ ...empty, ...r }); setOpen(true); };
  const save = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const payload = { ...form };
    try {
      if (edit) {
        await serverQuery({
          sql: `UPDATE clientes
                SET nome = ?, documento = ?, telefone = ?, email = ?, rua = ?, numero = ?, bairro = ?, cidade = ?, estado = ?, cep = ?, observacoes = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            payload.nome,
            payload.documento || null,
            payload.telefone || null,
            payload.email || null,
            payload.rua || null,
            payload.numero || null,
            payload.bairro || null,
            payload.cidade || null,
            payload.estado || null,
            payload.cep || null,
            payload.observacoes || null,
            edit.id,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO clientes (id, tenant_id, nome, documento, telefone, email, rua, numero, bairro, cidade, estado, cep, observacoes, arquivado)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            payload.nome,
            payload.documento || null,
            payload.telefone || null,
            payload.email || null,
            payload.rua || null,
            payload.numero || null,
            payload.bairro || null,
            payload.cidade || null,
            payload.estado || null,
            payload.cep || null,
            payload.observacoes || null,
            false,
          ],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Salvo!")); setOpen(false); qc.invalidateQueries({ queryKey: ["clientes"] });
  };
  const del = async (id: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "DELETE FROM clientes WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Excluído")); qc.invalidateQueries({ queryKey: ["clientes"] });
  };
  const archive = async (r: any) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "UPDATE clientes SET arquivado = ? WHERE id = ? AND tenant_id = ?",
        values: [!r.arquivado, r.id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["clientes"] });
  };

  return (
    <div>
      <PageHeader title="Clientes" action={<NewButton onClick={openNew} />} />
      <SearchBar value={q} onChange={setQ} placeholder="Buscar por nome ou documento..." />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Nome")}</TableHead><TableHead>{t("Documento")}</TableHead><TableHead>{t("Telefone")}</TableHead><TableHead>{t("Cidade")}</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((r: any) => (
              <TableRow key={r.id} className={r.arquivado ? "opacity-50" : ""}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell>{r.documento}</TableCell>
                <TableCell>{r.telefone}</TableCell>
                <TableCell>{r.cidade}</TableCell>
                <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={t("Editar cliente")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("Editar cliente")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => archive(r)} aria-label={r.arquivado ? t("Desarquivar") : t("Arquivar")}>
                          <Archive className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{r.arquivado ? t("Desarquivar") : t("Arquivar")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ConfirmDelete onConfirm={() => del(r.id)} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("Nenhum cliente.")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar cliente" : "Novo cliente"} onSubmit={save}>
        <div><Label>{t("Nome")}</Label><Input required value={form.nome} onChange={(e)=>setForm({...form,nome:e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("CPF/CNPJ")}</Label><Input value={form.documento} onChange={(e)=>setForm({...form,documento:maskCPFCNPJ(e.target.value)})} /></div>
          <div><Label>{t("Telefone")}</Label><Input value={form.telefone} onChange={(e)=>setForm({...form,telefone:maskPhone(e.target.value)})} /></div>
        </div>
        <div><Label>{t("E-mail")}</Label><Input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /></div>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2"><Label>{t("Rua")}</Label><Input value={form.rua} onChange={(e)=>setForm({...form,rua:e.target.value})} /></div>
          <div><Label>{t("Número")}</Label><Input value={form.numero} onChange={(e)=>setForm({...form,numero:e.target.value})} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Bairro")}</Label><Input value={form.bairro} onChange={(e)=>setForm({...form,bairro:e.target.value})} /></div>
          <div><Label>{t("Cidade")}</Label><Input value={form.cidade} onChange={(e)=>setForm({...form,cidade:e.target.value})} /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Estado")}</Label><Input maxLength={2} value={form.estado} onChange={(e)=>setForm({...form,estado:e.target.value.toUpperCase()})} /></div>
          <div><Label>{t("CEP")}</Label><Input value={form.cep} onChange={(e)=>setForm({...form,cep:maskCEP(e.target.value)})} /></div>
        </div>
        <div><Label>{t("Observações")}</Label><Textarea value={form.observacoes} onChange={(e)=>setForm({...form,observacoes:e.target.value})} /></div>
      </FormDialog>
    </div>
  );
}
