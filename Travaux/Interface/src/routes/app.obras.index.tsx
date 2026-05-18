import { createFileRoute, Link } from "@tanstack/react-router";
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
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, SearchBar, FormDialog, ConfirmDelete, NewButton } from "@/components/crud";
import { fmtBRL, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/obras/")({ component: Page });

const empty = {
  nome:"",
  cliente_id:"",
  tipo_servico:"drywall",
  endereco:"",
  lat:"",
  lng:"",
  raio:"",
  data_inicio:"",
  data_termino_prevista:"",
  valor_contratado:0,
  status:"orcamento",
  descricao:""
};

function normalizeNumberInput(value: any) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function normalizeDateInput(value: any) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

const STATUS_COLOR: Record<string,string> = {
  orcamento: "bg-muted text-muted-foreground",
  em_andamento: "bg-primary/15 text-primary",
  pausada: "bg-warning/20 text-warning-foreground",
  concluida: "bg-success/20 text-success",
  cancelada: "bg-destructive/20 text-destructive",
};

function Page() {
  const { user } = useAuth();
  const { t, tEnum } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: rows = [] } = useQuery({
    queryKey: ["obras", tenantId],
    queryFn: async () => (await serverQuery({
      sql: `SELECT o.*, c.nome AS cliente_nome
            FROM obras o
            LEFT JOIN clientes c ON c.id = o.cliente_id AND c.tenant_id = o.tenant_id
            WHERE o.tenant_id = ?
            ORDER BY o.created_at DESC`,
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-list", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT id, nome FROM clientes WHERE tenant_id = ? AND arquivado = ? ORDER BY nome",
      values: [tenantId, false],
    })) ?? [],
    enabled: Boolean(tenantId),
  });

  const filtered = rows.filter((r: any) => r.nome.toLowerCase().includes(q.toLowerCase()));

  const openNew = () => { setEdit(null); setForm({...empty}); setOpen(true); };
  const openEdit = (r: any) => {
    setEdit(r);
    setForm({
      ...empty,
      ...r,
      cliente_id: r.cliente_id ?? "",
      lat: normalizeNumberInput(r.lat),
      lng: normalizeNumberInput(r.lng),
      raio: normalizeNumberInput(r.raio),
      data_inicio: normalizeDateInput(r.data_inicio),
      data_termino_prevista: normalizeDateInput(r.data_termino_prevista),
    });
    setOpen(true);
  };
  const save = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const payload = {
      ...form,
      valor_contratado: Number(form.valor_contratado),
      cliente_id: form.cliente_id || null,
      lat: form.lat === "" ? null : Number(form.lat),
      lng: form.lng === "" ? null : Number(form.lng),
      raio: form.raio === "" ? null : Number(form.raio),
      data_inicio: form.data_inicio || null,
      data_termino_prevista: form.data_termino_prevista || null,
    };
    try {
      if (edit) {
        await serverQuery({
          sql: `UPDATE obras
                SET nome = ?, cliente_id = ?, tipo_servico = ?, endereco = ?, lat = ?, lng = ?, raio = ?, data_inicio = ?, data_termino_prevista = ?, valor_contratado = ?, status = ?, descricao = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            payload.nome,
            payload.cliente_id,
            payload.tipo_servico,
            payload.endereco || null,
            payload.lat,
            payload.lng,
            payload.raio,
            payload.data_inicio,
            payload.data_termino_prevista,
            payload.valor_contratado,
            payload.status,
            payload.descricao || null,
            edit.id,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO obras (id, tenant_id, nome, cliente_id, tipo_servico, endereco, lat, lng, raio, data_inicio, data_termino_prevista, valor_contratado, status, descricao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            payload.nome,
            payload.cliente_id,
            payload.tipo_servico,
            payload.endereco || null,
        payload.lat,
        payload.lng,
        payload.raio,
            payload.data_inicio,
            payload.data_termino_prevista,
            payload.valor_contratado,
            payload.status,
            payload.descricao || null,
          ],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Salvo!")); setOpen(false); qc.invalidateQueries({ queryKey: ["obras"] });
  };
  const del = async (id: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "DELETE FROM obras WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Excluído"));
    qc.invalidateQueries({ queryKey: ["obras"] });
  };

  return (
    <div>
      <PageHeader title="Obras" action={<NewButton onClick={openNew} />} />
      <SearchBar value={q} onChange={setQ} />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Nome")}</TableHead><TableHead>{t("Cliente")}</TableHead><TableHead>{t("Tipo")}</TableHead><TableHead>{t("Valor")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead>{t("Início")}</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium"><Link to="/app/obras/$id" params={{id: r.id}} className="text-primary hover:underline">{r.nome}</Link></TableCell>
                <TableCell>{r.cliente_nome ?? "-"}</TableCell>
                <TableCell className="capitalize">{r.tipo_servico === "drywall_masticagem" ? t("Drywall + Masticagem") : tEnum(r.tipo_servico)}</TableCell>
                <TableCell>{fmtBRL(r.valor_contratado)}</TableCell>
                <TableCell><Badge className={STATUS_COLOR[r.status]}>{tEnum(r.status)}</Badge></TableCell>
                <TableCell>{fmtDate(r.data_inicio)}</TableCell>
                <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={t("Editar obra")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("Editar obra")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ConfirmDelete onConfirm={() => del(r.id)} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("Nenhuma obra.")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar obra" : "Nova obra"} onSubmit={save}>
        <div><Label>{t("Nome da obra")}</Label><Input required value={form.nome} onChange={(e)=>setForm({...form,nome:e.target.value})}/></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Cliente")}</Label>
            <Select value={form.cliente_id} onValueChange={(v)=>setForm({...form,cliente_id:v})}>
              <SelectTrigger><SelectValue placeholder={t("Selecione")}/></SelectTrigger>
              <SelectContent>{clientes.map((c: any)=> <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
            </Select></div>
          <div><Label>{t("Tipo de serviço")}</Label>
            <Select value={form.tipo_servico} onValueChange={(v)=>setForm({...form,tipo_servico:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="drywall">Drywall</SelectItem><SelectItem value="masticagem">{t("Masticagem")}</SelectItem><SelectItem value="drywall_masticagem">{t("Drywall + Masticagem")}</SelectItem></SelectContent>
            </Select></div>
        </div>
        <div><Label>{t("Endereço da obra")}</Label><Input value={form.endereco} onChange={(e)=>setForm({...form,endereco:e.target.value})}/></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>{t("Latitude")}</Label><Input type="number" step="0.00000001" value={form.lat} onChange={(e)=>setForm({...form,lat:e.target.value})}/></div>
          <div><Label>{t("Longitude")}</Label><Input type="number" step="0.00000001" value={form.lng} onChange={(e)=>setForm({...form,lng:e.target.value})}/></div>
          <div><Label>{t("Raio (m)")}</Label><Input type="number" min="1" step="1" value={form.raio} onChange={(e)=>setForm({...form,raio:e.target.value})}/></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>{t("Início")}</Label><Input type="date" value={form.data_inicio ?? ""} onChange={(e)=>setForm({...form,data_inicio:e.target.value})}/></div>
          <div><Label>{t("Término previsto")}</Label><Input type="date" value={form.data_termino_prevista ?? ""} onChange={(e)=>setForm({...form,data_termino_prevista:e.target.value})}/></div>
          <div><Label>{t("Valor contratado")}</Label><CurrencyInput value={form.valor_contratado} onValueChange={(value)=>setForm({...form,valor_contratado:value})}/></div>
        </div>
        <div><Label>{t("Status")}</Label>
          <Select value={form.status} onValueChange={(v)=>setForm({...form,status:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="orcamento">{t("Orçamento")}</SelectItem><SelectItem value="em_andamento">{t("Em andamento")}</SelectItem><SelectItem value="pausada">{t("Pausada")}</SelectItem><SelectItem value="concluida">{t("Concluída")}</SelectItem><SelectItem value="cancelada">{t("Cancelada")}</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>{t("Descrição")}</Label><Textarea value={form.descricao} onChange={(e)=>setForm({...form,descricao:e.target.value})}/></div>
      </FormDialog>
    </div>
  );
}
