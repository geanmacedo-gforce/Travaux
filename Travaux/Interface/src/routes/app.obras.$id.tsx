import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { serverQuery } from "@/lib/server-api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialog, NewButton, ConfirmDelete } from "@/components/crud";
import { ComprovanteThumb } from "@/components/ComprovantePreview";
import { fmtBRL, fmtDate, fmtHours } from "@/lib/format";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/obras/$id")({ component: ObraDetail });

function normalizeDateInput(value: any) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function ObraDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { role, user } = useAuth();
  const { t, tEnum } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const isOwner = role === "proprietario";

  const { data: obra, isLoading: obraLoading, isError: obraError } = useQuery({
    queryKey: ["obra", id, tenantId],
    queryFn: async () => {
      const rows = await serverQuery({
        sql: `SELECT o.*, c.nome AS cliente_nome
              FROM obras o
              LEFT JOIN clientes c ON c.id = o.cliente_id AND c.tenant_id = o.tenant_id
              WHERE o.id = ? AND o.tenant_id = ?
              LIMIT 1`,
        values: [id, tenantId],
      });
      return (rows as any[])?.[0] ?? null;
    },
    enabled: Boolean(tenantId),
  });
  const { data: horas = [] } = useQuery({
    queryKey: ["horas", id, tenantId],
    queryFn: async () => {
      try {
        return (await serverQuery({
          sql: `SELECT h.*, DATE(COALESCE(h.entrada, h.created_at)) AS data_ref, f.nome AS funcionario_nome
                FROM horas_trabalhadas h
                LEFT JOIN funcionarios f ON f.id = h.funcionario_id AND f.tenant_id = h.tenant_id
                WHERE h.obra_id = ? AND h.tenant_id = ?
                ORDER BY h.entrada DESC, h.created_at DESC`,
          values: [id, tenantId],
        })) ?? [];
      } catch {
        // Fallback para bancos legados que ainda usam apenas a coluna `data`.
        return (await serverQuery({
          sql: `SELECT h.*, h.data AS data_ref, f.nome AS funcionario_nome
                FROM horas_trabalhadas h
                LEFT JOIN funcionarios f ON f.id = h.funcionario_id AND f.tenant_id = h.tenant_id
                WHERE h.obra_id = ? AND h.tenant_id = ?
                ORDER BY h.data DESC, h.created_at DESC`,
          values: [id, tenantId],
        })) ?? [];
      }
    },
    enabled: Boolean(tenantId),
  });
  const { data: mats = [] } = useQuery({
    queryKey: ["materiais", id, tenantId],
    queryFn: async () => (await serverQuery({
      sql: `SELECT m.*, p.nome AS produto_nome, p.unidade AS produto_unidade
            FROM materiais_usados m
            LEFT JOIN produtos p ON p.id = m.produto_id AND p.tenant_id = m.tenant_id
            WHERE m.obra_id = ? AND m.tenant_id = ?
            ORDER BY m.data DESC`,
      values: [id, tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: desp = [] } = useQuery({
    queryKey: ["despesas", id, tenantId],
    queryFn: async () => (await serverQuery({
      sql: `SELECT d.*, f.nome AS responsavel_nome
            FROM despesas d
            LEFT JOIN funcionarios f ON f.id = d.responsavel_id AND f.tenant_id = d.tenant_id
            WHERE d.obra_id = ? AND d.tenant_id = ?
            ORDER BY d.data DESC`,
      values: [id, tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: funcs = [] } = useQuery({
    queryKey: ["funcs-list", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT * FROM funcionarios WHERE tenant_id = ? ORDER BY nome",
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ["prod-list", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT * FROM produtos WHERE tenant_id = ? ORDER BY nome",
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: divs = [] } = useQuery({
    queryKey: ["divs", id, tenantId],
    queryFn: async () => (await serverQuery({
      sql: `SELECT d.*, f.nome AS funcionario_nome
            FROM bot_checkin_divergencias d
            LEFT JOIN funcionarios f ON f.id = d.funcionario_id AND f.tenant_id = d.tenant_id
            WHERE d.obra_id = ? AND d.tenant_id = ?
            ORDER BY d.created_at DESC`,
      values: [id, tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });

  // Horas form
  const [hOpen, setHOpen] = useState(false);
  const [hEdit, setHEdit] = useState<any | null>(null);
  const [hForm, setHForm] = useState<any>({ funcionario_id:"", data: new Date().toISOString().slice(0,10), horas: 8, descricao:"" });
  const openHNew = () => { setHEdit(null); setHForm({ funcionario_id:"", data: new Date().toISOString().slice(0,10), horas: 8, descricao:"" }); setHOpen(true); };
  const openHEdit = (h: any) => {
    setHEdit(h);
    setHForm({
      funcionario_id: h.funcionario_id,
      data: normalizeDateInput(h.data),
      horas: h.horas,
      descricao: h.descricao ?? "",
    });
    setHOpen(true);
  };
  const saveHoras = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const f = funcs.find((x:any)=>x.id===hForm.funcionario_id); if (!f) return toast.error(t("Selecione funcionário") || (t("Selecione") + " " + t("Funcionário")).trim());
    const valor_hora = f.tipo_remuneracao === "hora" ? Number(f.valor) : f.tipo_remuneracao === "diaria" ? Number(f.valor)/8 : Number(f.valor)/220;
    const valor_total = valor_hora * Number(hForm.horas);
    const payload = { obra_id: id, funcionario_id: hForm.funcionario_id, data: hForm.data, horas: Number(hForm.horas), valor_hora, valor_total, descricao: hForm.descricao };
    try {
      if (hEdit) {
        await serverQuery({
          sql: `UPDATE horas_trabalhadas
                SET obra_id = ?, funcionario_id = ?, data = ?, horas = ?, valor_hora = ?, valor_total = ?, descricao = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [payload.obra_id, payload.funcionario_id, payload.data, payload.horas, payload.valor_hora, payload.valor_total, payload.descricao || null, hEdit.id, tenantId],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO horas_trabalhadas (id, tenant_id, obra_id, funcionario_id, data, horas, valor_hora, valor_total, descricao)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [crypto.randomUUID(), tenantId, payload.obra_id, payload.funcionario_id, payload.data, payload.horas, payload.valor_hora, payload.valor_total, payload.descricao || null],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(hEdit ? (t("Horas atualizadas") || (t("Horas") + " updated")) : (t("Horas registradas") || (t("Horas") + " recorded"))); setHOpen(false); qc.invalidateQueries({ queryKey: ["horas", id] });
  };

  // Materiais
  const [mOpen, setMOpen] = useState(false);
  const [mEdit, setMEdit] = useState<any | null>(null);
  const [mFile, setMFile] = useState<File | null>(null);
  const [mForm, setMForm] = useState<any>({ produto_id:"", quantidade:1, valor_unitario:0, data: new Date().toISOString().slice(0,10), observacoes:"", link_url:"" });
  const onProdChange = (pid: string) => {
    const p = produtos.find((x:any)=>x.id===pid);
    setMForm({ ...mForm, produto_id: pid, valor_unitario: p ? Number(p.valor_unitario) : 0 });
  };
  const openMNew = () => { setMEdit(null); setMFile(null); setMForm({ produto_id:"", quantidade:1, valor_unitario:0, data: new Date().toISOString().slice(0,10), observacoes:"", link_url:"" }); setMOpen(true); };
  const openMEdit = (m: any) => {
    setMEdit(m);
    setMFile(null);
    setMForm({
      produto_id: m.produto_id ?? "",
      quantidade: m.quantidade,
      valor_unitario: m.valor_unitario,
      data: normalizeDateInput(m.data),
      observacoes: m.observacoes ?? "",
      link_url: m.link_url ?? "",
    });
    setMOpen(true);
  };
  const saveMat = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const valor_total = Number(mForm.quantidade) * Number(mForm.valor_unitario);
    let comprovante_url: string | null | undefined = undefined;
    if (mFile) {
      const ext = mFile.name.split(".").pop();
      const path = `materiais/${id}/${Date.now()}.${ext}`;
      comprovante_url = path;
    }
    const payload: any = { obra_id: id, produto_id: mForm.produto_id || null, quantidade: Number(mForm.quantidade), valor_unitario: Number(mForm.valor_unitario), valor_total, data: mForm.data, observacoes: mForm.observacoes, link_url: mForm.link_url || null };
    if (comprovante_url !== undefined) payload.comprovante_url = comprovante_url;
    try {
      if (mEdit) {
        await serverQuery({
          sql: `UPDATE materiais_usados
                SET obra_id = ?, produto_id = ?, quantidade = ?, valor_unitario = ?, valor_total = ?, data = ?, observacoes = ?, link_url = ?, comprovante_url = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [payload.obra_id, payload.produto_id, payload.quantidade, payload.valor_unitario, payload.valor_total, payload.data, payload.observacoes || null, payload.link_url, payload.comprovante_url || mEdit.comprovante_url || null, mEdit.id, tenantId],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO materiais_usados (id, tenant_id, obra_id, produto_id, quantidade, valor_unitario, valor_total, data, observacoes, comprovante_url, link_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [crypto.randomUUID(), tenantId, payload.obra_id, payload.produto_id, payload.quantidade, payload.valor_unitario, payload.valor_total, payload.data, payload.observacoes || null, payload.comprovante_url || null, payload.link_url],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(mEdit ? (t("Material atualizado") || "Material updated") : (t("Material registrado") || "Material recorded"));
    setMOpen(false); setMFile(null);
    setMForm({ produto_id:"", quantidade:1, valor_unitario:0, data: new Date().toISOString().slice(0,10), observacoes:"", link_url:"" });
    qc.invalidateQueries({ queryKey: ["materiais", id] });
  };

  const delHoras = async (rid: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    await serverQuery({ sql: "DELETE FROM horas_trabalhadas WHERE id = ? AND tenant_id = ?", values: [rid, tenantId] });
    qc.invalidateQueries({ queryKey: ["horas", id] });
  };
  const delMat = async (rid: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    await serverQuery({ sql: "DELETE FROM materiais_usados WHERE id = ? AND tenant_id = ?", values: [rid, tenantId] });
    qc.invalidateQueries({ queryKey: ["materiais", id] });
  };

  if (obraLoading) return <div>{t("Carregando…") || "Loading..."}</div>;
  if (obraError || !obra) return <div className="p-4 text-muted-foreground">{t("Obra nao encontrada ou indisponivel.") || "Project not found or unavailable."}</div>;

  const getValorHoraFuncionario = (funcionario: any) => {
    const valorBase = Number(funcionario?.valor ?? 0);
    if (funcionario?.tipo_remuneracao === "diaria") return valorBase / 8;
    if (funcionario?.tipo_remuneracao === "mensal") return valorBase / 220;
    return valorBase;
  };

  const getHoraValorTotal = (hora: any) => {
    const stored = Number(hora?.valor_total ?? 0);
    if (stored > 0) return stored;
    const funcionario = funcs.find((item: any) => item.id === hora.funcionario_id);
    return getValorHoraFuncionario(funcionario) * Number(hora?.horas ?? 0);
  };

  const totalMO = horas.reduce((sum:number,h:any)=>sum + getHoraValorTotal(h), 0);
  const totalMat = desp
    .filter((d:any)=>d.categoria === "produtos_insumos" || Boolean(d.produto_id))
    .reduce((sum:number,d:any)=>sum + Number(d.valor ?? 0), 0);
  const cat = (c: string) => desp
    .filter((d:any)=>d.categoria===c && !d.produto_id)
    .reduce((s:number,d:any)=>s+Number(d.valor),0);
  const totComb = cat("combustivel"), totAlim = cat("alimentacao"), totHosp = cat("hospedagem"), totOut = cat("outros");
  const totalGeral = totalMO + totalMat + totComb + totAlim + totHosp + totOut;
  const lucro = Number(obra.valor_contratado) - totalGeral;
  const margem = obra.valor_contratado > 0 ? (lucro / Number(obra.valor_contratado)) * 100 : 0;

  return (
    <div className="space-y-4">
      <Link to="/app/obras" className="text-sm text-muted-foreground inline-flex items-center hover:text-primary"><ArrowLeft className="h-3 w-3 mr-1"/> {t("Voltar")}</Link>
      <div>
        <h1 className="text-2xl font-bold">{obra.nome}</h1>
        <p className="text-sm text-muted-foreground">{obra.cliente_nome} · {obra.endereco}</p>
      </div>

      <div className="grid md:grid-cols-4 gap-3">
        <Mini label={t("Orçamento")} value={fmtBRL(obra.valor_contratado)}/>
        <Mini label={t("Mão de obra")} value={fmtBRL(totalMO)}/>
        <Mini label={t("Materiais")} value={fmtBRL(totalMat)}/>
        <Mini label={t("Total gastos")} value={fmtBRL(totalGeral)} />
      </div>
      <div className="grid md:grid-cols-4 gap-3">
        <Mini label={t("Combustível")} value={fmtBRL(totComb)}/>
        <Mini label={t("Alimentação")} value={fmtBRL(totAlim)}/>
        <Mini label={t("Hospedagem")} value={fmtBRL(totHosp)}/>
        <Mini label={t("Outros")} value={fmtBRL(totOut)}/>
      </div>
      {isOwner && (
        <div className="grid md:grid-cols-2 gap-3">
          <Mini label={t("Lucro líquido")} value={fmtBRL(lucro)} accent={lucro >= 0 ? "success" : "destructive"} />
          <Mini label={t("Margem")} value={`${margem.toFixed(1)}%`} accent={margem >= 0 ? "success" : "destructive"} />
        </div>
      )}

      <Tabs defaultValue="funcionarios">
        <TabsList>
          <TabsTrigger value="funcionarios">{t("Funcionários")}</TabsTrigger>
          <TabsTrigger value="despesas">{t("Despesas")}</TabsTrigger>
        </TabsList>

        <TabsContent value="funcionarios">
          <Card><CardHeader><CardTitle>{t("Funcionários desta obra") || "Employees on this project"}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t("Funcionário")}</TableHead><TableHead>{t("Função")}</TableHead><TableHead>{t("Dias trabalhados")}</TableHead><TableHead>{t("Total horas")}</TableHead><TableHead>{t("Total pago") || "Total paid"}</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(() => {
                    const map = new Map<string, { nome: string; funcao?: string; horas: number; valor: number; dias: Set<string> }>();
                    horas.forEach((h: any) => {
                      const cur = map.get(h.funcionario_id) ?? { nome: h.funcionario_nome ?? "—", horas: 0, valor: 0, dias: new Set<string>() };
                      const baseDate = h.data_ref ?? h.data ?? h.entrada ?? h.created_at;
                      if (baseDate) {
                        cur.dias.add(String(baseDate).slice(0, 10));
                      }
                      cur.horas += Number(h.horas);
                      cur.valor += getHoraValorTotal(h);
                      map.set(h.funcionario_id, cur);
                    });
                    map.forEach((v, k) => { const f = funcs.find((x: any) => x.id === k); if (f) v.funcao = f.funcao; });
                    const rows = Array.from(map.entries());
                    if (rows.length === 0) return <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">{t("Nenhum funcionário registrou horas.") || "No employee has recorded hours."}</TableCell></TableRow>;
                    return rows.map(([k, v]) => (
                      <TableRow key={k}>
                        <TableCell>{v.nome}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">{v.funcao ? tEnum(v.funcao) : "—"}</TableCell>
                        <TableCell>{v.dias.size}</TableCell>
                        <TableCell>{fmtHours(v.horas)}</TableCell>
                        <TableCell>{fmtBRL(v.valor)}</TableCell>
                      </TableRow>
                    ));
                  })()}
                </TableBody>
              </Table>
            </CardContent></Card>
        </TabsContent>

        <TabsContent value="despesas">
          <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle>{t("Despesas operacionais") || "Operating expenses"}</CardTitle>
            <Button asChild variant="outline" size="sm"><Link to="/app/despesas">{t("Gerenciar despesas") || "Manage expenses"}</Link></Button></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow><TableHead>{t("Data")}</TableHead><TableHead>{t("Categoria")}</TableHead><TableHead>{t("Descrição")}</TableHead><TableHead>{t("Responsável")}</TableHead><TableHead>{t("Valor")}</TableHead><TableHead>{t("Comprovante")}</TableHead></TableRow></TableHeader>
                <TableBody>{desp.map((d:any)=>(<TableRow key={d.id}><TableCell>{fmtDate(d.data)}</TableCell><TableCell className="capitalize">{tEnum(d.categoria)}</TableCell><TableCell className="text-xs">{d.descricao}</TableCell><TableCell>{d.responsavel_nome ?? "-"}</TableCell><TableCell>{fmtBRL(d.valor)}</TableCell><TableCell><ComprovanteThumb path={d.comprovante_url}/></TableCell></TableRow>))}
                {desp.length===0 && <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">{t("Sem despesas.") || "No expenses."}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent></Card>
        </TabsContent>

      </Tabs>

      <FormDialog open={hOpen} onOpenChange={setHOpen} title="Registrar horas" onSubmit={saveHoras}>
        <div><Label>{t("Funcionário")}</Label>
          <Select value={hForm.funcionario_id} onValueChange={(v)=>setHForm({...hForm,funcionario_id:v})}>
            <SelectTrigger><SelectValue placeholder={t("Selecione")}/></SelectTrigger>
            <SelectContent>{funcs.map((f:any)=><SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Data")}</Label><Input type="date" value={hForm.data} onChange={(e)=>setHForm({...hForm,data:e.target.value})}/></div>
          <div><Label>{t("Horas")}</Label><Input type="number" step="0.5" value={hForm.horas} onChange={(e)=>setHForm({...hForm,horas:e.target.value})}/></div>
        </div>
        <div><Label>{t("Descrição da atividade") || "Activity description"}</Label><Textarea value={hForm.descricao} onChange={(e)=>setHForm({...hForm,descricao:e.target.value})}/></div>
      </FormDialog>

      <FormDialog open={mOpen} onOpenChange={setMOpen} title="Registrar material" onSubmit={saveMat}>
        <div><Label>{t("Produto") || "Product"}</Label>
          <Select value={mForm.produto_id} onValueChange={onProdChange}>
            <SelectTrigger><SelectValue placeholder={t("Selecione")}/></SelectTrigger>
            <SelectContent>{produtos.map((p:any)=><SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
          </Select></div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>{t("Quantidade") || "Quantity"}</Label><Input type="number" step="0.01" value={mForm.quantidade} onChange={(e)=>setMForm({...mForm,quantidade:e.target.value})}/></div>
          <div><Label>{t("Valor unit.") || "Unit price"}</Label><CurrencyInput value={mForm.valor_unitario} onValueChange={(value)=>setMForm({...mForm,valor_unitario:value})}/></div>
          <div><Label>{t("Data")}</Label><Input type="date" value={mForm.data} onChange={(e)=>setMForm({...mForm,data:e.target.value})}/></div>
        </div>
        <div><Label>{t("Comprovante (imagem ou PDF)") || "Receipt (image or PDF)"}</Label><Input type="file" accept="image/*,application/pdf" onChange={(e)=>setMFile(e.target.files?.[0] ?? null)}/></div>
        <div><Label>{t("Link (nota fiscal online, pedido, etc.)") || "Link (online invoice, order, etc.)"}</Label><Input type="url" placeholder="https://..." value={mForm.link_url} onChange={(e)=>setMForm({...mForm,link_url:e.target.value})}/></div>
        <div><Label>{t("Observações")}</Label><Textarea value={mForm.observacoes} onChange={(e)=>setMForm({...mForm,observacoes:e.target.value})}/></div>
        <div className="text-sm text-muted-foreground">{t("Total") || "Total"}: <strong>{fmtBRL(Number(mForm.quantidade)*Number(mForm.valor_unitario))}</strong></div>
      </FormDialog>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: any; accent?: "success" | "destructive" }) {
  const cls = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-lg font-bold ${cls}`}>{value}</div></CardContent></Card>
  );
}
