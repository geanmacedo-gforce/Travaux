import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { serverQuery } from "@/lib/server-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, SearchBar, FormDialog, ConfirmDelete, NewButton } from "@/components/crud";
import { fmtBRL } from "@/lib/format";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/produtos")({ component: Page });
const empty = { nome:"", categoria:"outros", unidade:"un", valor_unitario:0, fornecedor:"", observacoes:"" };

function Page() {
  const { user } = useAuth();
  const { t, tEnum } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["produtos", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT * FROM produtos WHERE tenant_id = ? ORDER BY nome",
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const filtered = rows.filter((r: any) =>
    r.nome.toLowerCase().includes(q.toLowerCase()) && (cat === "all" || r.categoria === cat));

  const openNew = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => { setEdit(r); setForm({...r}); setOpen(true); };
  const save = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const payload = {...form, valor_unitario: Number(form.valor_unitario)};
    try {
      if (edit) {
        await serverQuery({
          sql: `UPDATE produtos
                SET nome = ?, categoria = ?, unidade = ?, valor_unitario = ?, fornecedor = ?, observacoes = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            payload.nome,
            payload.categoria,
            payload.unidade,
            payload.valor_unitario,
            payload.fornecedor || null,
            payload.observacoes || null,
            edit.id,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO produtos (id, tenant_id, nome, categoria, unidade, valor_unitario, fornecedor, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            payload.nome,
            payload.categoria,
            payload.unidade,
            payload.valor_unitario,
            payload.fornecedor || null,
            payload.observacoes || null,
          ],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Salvo!")); setOpen(false); qc.invalidateQueries({ queryKey: ["produtos"] });
  };
  const del = async (id: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "DELETE FROM produtos WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Excluído"));
    qc.invalidateQueries({ queryKey: ["produtos"] });
  };

  return (
    <div>
      <PageHeader title="Produtos & Insumos" action={<NewButton onClick={openNew} />} />
      <div className="flex gap-2 mb-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} />
        <Select value={cat} onValueChange={setCat}>
          <SelectTrigger className="w-48"><SelectValue/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("Todas categorias")}</SelectItem>
            <SelectItem value="drywall">Drywall</SelectItem>
            <SelectItem value="masticagem">{t("Masticagem")}</SelectItem>
            <SelectItem value="fixacao">{t("Fixação")}</SelectItem>
            <SelectItem value="epi">EPI</SelectItem>
            <SelectItem value="outros">{t("Outros")}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Nome")}</TableHead><TableHead>{t("Categoria")}</TableHead><TableHead>{t("Unidade")}</TableHead><TableHead>{t("Valor")}</TableHead><TableHead>{t("Fornecedor")}</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="capitalize">{tEnum(r.categoria)}</TableCell>
                <TableCell>{r.unidade}</TableCell>
                <TableCell>{fmtBRL(r.valor_unitario)}</TableCell>
                <TableCell>{r.fornecedor}</TableCell>
                <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={t("Editar produto")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("Editar produto")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ConfirmDelete onConfirm={() => del(r.id)} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("Nenhum produto.")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar produto" : "Novo produto"} onSubmit={save}>
        <div><Label>{t("Nome")}</Label><Input required value={form.nome} onChange={(e)=>setForm({...form,nome:e.target.value})}/></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Categoria")}</Label>
            <Select value={form.categoria} onValueChange={(v)=>setForm({...form,categoria:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="drywall">Drywall</SelectItem><SelectItem value="masticagem">{t("Masticagem")}</SelectItem><SelectItem value="fixacao">{t("Fixação")}</SelectItem><SelectItem value="epi">EPI</SelectItem><SelectItem value="outros">{t("Outros")}</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>{t("Unidade")}</Label>
            <Select value={form.unidade} onValueChange={(v)=>setForm({...form,unidade:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{["m²","metro","peça","kg","litro","rolo","caixa","un"].map((u)=><SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Valor unitário")}</Label><CurrencyInput value={form.valor_unitario} onValueChange={(value)=>setForm({...form,valor_unitario:value})}/></div>
          <div><Label>{t("Fornecedor")}</Label><Input value={form.fornecedor} onChange={(e)=>setForm({...form,fornecedor:e.target.value})}/></div>
        </div>
        <div><Label>{t("Observações")}</Label><Textarea value={form.observacoes} onChange={(e)=>setForm({...form,observacoes:e.target.value})}/></div>
      </FormDialog>
    </div>
  );
}
