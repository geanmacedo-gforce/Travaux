import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { serverQuery } from "@/lib/server-api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/crud";
import { fmtBRL } from "@/lib/format";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line, CartesianGrid } from "recharts";
import { useI18n } from "@/lib/i18n";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";

const BRAND_PRIMARY = "#E8620A";
const BRAND_SECONDARY = "#1A1A1A";
const PIE_COLORS = ["#E8620A","#1A1A1A","#9CA3AF","#F2A368","#4B5563","#FBBF24"];

export const Route = createFileRoute("/app/relatorios")({ component: Page });

function Page() {
  const { role, user } = useAuth();
  const { t } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const isOwner = role === "proprietario";
  const today = new Date();
  const [inicio, setInicio] = useState(new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10));
  const [fim, setFim] = useState(new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10));
  const [obraFilters, setObraFilters] = useState<Set<string>>(new Set());
  const [funcionarioFilters, setFuncionarioFilters] = useState<Set<string>>(new Set());
  const [clienteFilters, setClienteFilters] = useState<Set<string>>(new Set());

  const { data: lookups } = useQuery({
    queryKey: ["relatorios-lookups", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const [obras, funcs, clientes] = await Promise.all([
        serverQuery({ sql: "SELECT id, nome, cliente_id, valor_contratado FROM obras WHERE tenant_id = ? ORDER BY nome", values: [tenantId] }),
        serverQuery({ sql: "SELECT id, nome FROM funcionarios WHERE tenant_id = ? ORDER BY nome", values: [tenantId] }),
        serverQuery({ sql: "SELECT id, nome FROM clientes WHERE tenant_id = ? ORDER BY nome", values: [tenantId] }),
      ]);
      return { obras: obras ?? [], funcs: funcs ?? [], clientes: clientes ?? [] };
    },
  });
  const obrasAll = lookups?.obras ?? [];
  const funcsAll = lookups?.funcs ?? [];
  const clientesAll = lookups?.clientes ?? [];

  const { data } = useQuery({
    queryKey: ["relatorios", inicio, fim, tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      const [horas, mats, desp] = await Promise.all([
        serverQuery({
          sql: "SELECT * FROM horas_trabalhadas WHERE tenant_id = ? AND data >= ? AND data <= ?",
          values: [tenantId, inicio, fim],
        }),
        serverQuery({
          sql: "SELECT * FROM materiais_usados WHERE tenant_id = ? AND data >= ? AND data <= ?",
          values: [tenantId, inicio, fim],
        }),
        serverQuery({
          sql: "SELECT * FROM despesas WHERE tenant_id = ? AND data >= ? AND data <= ?",
          values: [tenantId, inicio, fim],
        }),
      ]);
      return { horas: horas ?? [], mats: mats ?? [], desp: desp ?? [] };
    },
  });
  const { horas = [], mats = [], desp = [] } = data ?? {};

  // Apply filters: cliente -> filtra obras; obra -> filtra registros; funcionario -> filtra horas
  const { obrasF, horasF, matsF, despF } = useMemo(() => {
    let obrasF = obrasAll as any[];
    if (clienteFilters.size > 0) obrasF = obrasF.filter((o) => clienteFilters.has(o.cliente_id));
    if (obraFilters.size > 0) obrasF = obrasF.filter((o) => obraFilters.has(o.id));
    const obraIds = new Set(obrasF.map((o) => o.id));

    let horasF = (horas as any[]).filter((h) => obraIds.has(h.obra_id));
    if (funcionarioFilters.size > 0) horasF = horasF.filter((h) => funcionarioFilters.has(h.funcionario_id));

    const matsF = (mats as any[]).filter((m) => obraIds.has(m.obra_id));
    const despF = (desp as any[]).filter((d) => obraIds.has(d.obra_id));

    // Se filtra por funcionário, restringe obras às que tiveram horas dele
    let obrasFinal = obrasF;
    if (funcionarioFilters.size > 0) {
      const obrasComFunc = new Set(horasF.map((h) => h.obra_id));
      obrasFinal = obrasF.filter((o) => obrasComFunc.has(o.id));
    }
    return { obrasF: obrasFinal, horasF, matsF, despF };
  }, [obrasAll, horas, mats, desp, obraFilters, funcionarioFilters, clienteFilters]);

  const totalMO = horasF.reduce((s, h: any) => s + Number(h.valor_total), 0);
  const totalMat = matsF.reduce((s, m: any) => s + Number(m.valor_total), 0);
  const cat = (c: string) => despF.filter((d: any) => d.categoria === c).reduce((s: number, d: any) => s + Number(d.valor), 0);
  const totComb = cat("combustivel"), totAlim = cat("alimentacao"), totHosp = cat("hospedagem"), totOut = cat("outros");
  const totalGastos = totalMO + totalMat + totComb + totAlim + totHosp + totOut;
  const fat = obrasF.reduce((s, o: any) => s + Number(o.valor_contratado), 0);
  const lucro = fat - totalGastos;
  const margem = fat > 0 ? (lucro / fat) * 100 : 0;

  // Pizza por categoria
  const pieData = [
    { name: t("Mão de obra"), value: totalMO },
    { name: t("Materiais"), value: totalMat },
    { name: t("Combustível"), value: totComb },
    { name: t("Alimentação"), value: totAlim },
    { name: t("Hospedagem"), value: totHosp },
    { name: t("Outros"), value: totOut },
  ].filter((p) => p.value > 0);

  // Barras por obra
  const barObras = obrasF.slice(0, 8).map((o: any) => {
    const mo = horasF.filter((h: any) => h.obra_id === o.id).reduce((s: number, h: any) => s + Number(h.valor_total), 0);
    const ma = matsF.filter((m: any) => m.obra_id === o.id).reduce((s: number, m: any) => s + Number(m.valor_total), 0);
    const de = despF.filter((d: any) => d.obra_id === o.id).reduce((s: number, d: any) => s + Number(d.valor), 0);
    return { nome: o.nome.slice(0, 14), [t("Faturado")]: Number(o.valor_contratado), [t("Gastos")]: mo + ma + de };
  });

  // Linha por dia (gastos)
  const byDay = new Map<string, number>();
  [...horasF.map((h: any) => ({ data: h.data, valor: Number(h.valor_total) })),
   ...matsF.map((m: any) => ({ data: m.data, valor: Number(m.valor_total) })),
   ...despF.map((d: any) => ({ data: d.data, valor: Number(d.valor) }))]
    .forEach((r) => byDay.set(r.data, (byDay.get(r.data) ?? 0) + r.valor));
  const lineData = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, valor]) => ({ data: data.slice(5), [t("Gastos")]: valor }));

  const clearFilters = () => {
    setObraFilters(new Set());
    setFuncionarioFilters(new Set());
    setClienteFilters(new Set());
  };

  const obraOptions = useMemo(
    () => obrasAll
      .filter((o: any) => clienteFilters.size === 0 || clienteFilters.has(o.cliente_id))
      .map((o: any) => ({ value: o.id, label: o.nome })),
    [obrasAll, clienteFilters],
  );

  const clienteOptions = useMemo(
    () => clientesAll.map((c: any) => ({ value: c.id, label: c.nome })),
    [clientesAll],
  );

  const funcionarioOptions = useMemo(
    () => funcsAll.map((f: any) => ({ value: f.id, label: f.nome })),
    [funcsAll],
  );

  return (
    <div>
      <PageHeader title="Relatórios" />
      <div className="grid gap-3 mb-4 md:grid-cols-5">
        <div><Label>{t("Início")}</Label><Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></div>
        <div><Label>{t("Fim")}</Label><Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
        <MultiSelectFilter
          title={t("Cliente(s)")}
          options={clienteOptions}
          selected={clienteFilters}
          onChange={setClienteFilters}
          emptyText={t("Nenhum cliente")}
          selectAllText={t("Selecionar todos")}
          clearSelectionText={t("Limpar seleção")}
        />
        <MultiSelectFilter
          title={t("Obra(s)")}
          options={obraOptions}
          selected={obraFilters}
          onChange={setObraFilters}
          emptyText={t("Nenhuma obra")}
          selectAllText={t("Selecionar todos")}
          clearSelectionText={t("Limpar seleção")}
        />
        <MultiSelectFilter
          title={t("Funcionário(s)")}
          options={funcionarioOptions}
          selected={funcionarioFilters}
          onChange={setFuncionarioFilters}
          emptyText={t("Nenhum funcionário")}
          selectAllText={t("Selecionar todos")}
          clearSelectionText={t("Limpar seleção")}
        />
      </div>
      {(obraFilters.size > 0 || funcionarioFilters.size > 0 || clienteFilters.size > 0) && (
        <Button variant="outline" size="sm" className="mb-4" onClick={clearFilters}>{t("Limpar filtros")}</Button>
      )}

      {isOwner && (
        <Card className="mb-4">
          <CardHeader><CardTitle>{t("Resumo financeiro do período")}</CardTitle></CardHeader>
          <CardContent className="grid md:grid-cols-4 gap-3">
            <Stat label={t("Faturamento")} value={fmtBRL(fat)} />
            <Stat label={t("Total gastos")} value={fmtBRL(totalGastos)} />
            <Stat label={t("Lucro líquido")} value={fmtBRL(lucro)} accent={lucro >= 0 ? "success" : "destructive"} />
            <Stat label={t("Margem")} value={`${margem.toFixed(1)}%`} accent={margem >= 0 ? "success" : "destructive"} />
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader><CardTitle>{t("Gastos por categoria")}</CardTitle></CardHeader>
        <CardContent className="grid md:grid-cols-3 gap-3">
          <Stat label={t("Mão de obra")} value={fmtBRL(totalMO)} />
          <Stat label={t("Materiais")} value={fmtBRL(totalMat)} />
          <Stat label={t("Combustível")} value={fmtBRL(totComb)} />
          <Stat label={t("Alimentação")} value={fmtBRL(totAlim)} />
          <Stat label={t("Hospedagem")} value={fmtBRL(totHosp)} />
          <Stat label={t("Outros")} value={fmtBRL(totOut)} />
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><CardTitle>{t("Faturamento vs Gastos por obra")}</CardTitle></CardHeader>
          <CardContent className="h-72">
            {barObras.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">{t("Sem dados no período.")}</div>
            ) : (
              <ResponsiveContainer><BarChart data={barObras}><CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" /><XAxis dataKey="nome" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(v: any) => fmtBRL(Number(v))} /><Legend /><Bar dataKey={t("Faturado")} fill={BRAND_PRIMARY} /><Bar dataKey={t("Gastos")} fill={BRAND_SECONDARY} /></BarChart></ResponsiveContainer>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("Distribuição de gastos")}</CardTitle></CardHeader>
          <CardContent className="h-72">
            {pieData.length === 0 ? (
              <div className="h-full grid place-items-center text-sm text-muted-foreground">{t("Sem gastos no período.")}</div>
            ) : (
              <ResponsiveContainer><PieChart><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}</Pie><Legend /><Tooltip formatter={(v: any) => fmtBRL(Number(v))} /></PieChart></ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>{t("Evolução de gastos no período")}</CardTitle></CardHeader>
        <CardContent className="h-72">
          {lineData.length === 0 ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">{t("Sem lançamentos no período.")}</div>
          ) : (
            <ResponsiveContainer><LineChart data={lineData}><CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" /><XAxis dataKey="data" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(v: any) => fmtBRL(Number(v))} /><Line type="monotone" dataKey={t("Gastos")} stroke={BRAND_PRIMARY} strokeWidth={2} dot={{ r: 3 }} /></LineChart></ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("Por obra")}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow><TableHead>{t("Obra")}</TableHead><TableHead>{t("Faturado")}</TableHead><TableHead>MO</TableHead><TableHead>{t("Mat.")}</TableHead><TableHead>Desp.</TableHead><TableHead>{t("Total gastos")}</TableHead>{isOwner && <><TableHead>{t("Lucro")}</TableHead><TableHead>{t("Margem")}</TableHead></>}</TableRow></TableHeader>
            <TableBody>
              {obrasF.map((o: any) => {
                const mo = horasF.filter((h: any) => h.obra_id === o.id).reduce((s: number, h: any) => s + Number(h.valor_total), 0);
                const ma = matsF.filter((m: any) => m.obra_id === o.id).reduce((s: number, m: any) => s + Number(m.valor_total), 0);
                const de = despF.filter((d: any) => d.obra_id === o.id).reduce((s: number, d: any) => s + Number(d.valor), 0);
                const tot = mo + ma + de;
                const lu = Number(o.valor_contratado) - tot;
                const mg = o.valor_contratado > 0 ? (lu / Number(o.valor_contratado)) * 100 : 0;
                return (
                  <TableRow key={o.id}>
                    <TableCell className="font-medium">{o.nome}</TableCell>
                    <TableCell>{fmtBRL(o.valor_contratado)}</TableCell>
                    <TableCell>{fmtBRL(mo)}</TableCell>
                    <TableCell>{fmtBRL(ma)}</TableCell>
                    <TableCell>{fmtBRL(de)}</TableCell>
                    <TableCell>{fmtBRL(tot)}</TableCell>
                    {isOwner && <><TableCell className={lu >= 0 ? "text-success" : "text-destructive"}>{fmtBRL(lu)}</TableCell><TableCell>{mg.toFixed(1)}%</TableCell></>}
                  </TableRow>
                );
              })}
              {obrasF.length === 0 && <TableRow><TableCell colSpan={isOwner ? 8 : 6} className="text-center text-muted-foreground py-6">{t("Nenhum dado para os filtros selecionados.")}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: "success" | "destructive" }) {
  const cls = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "";
  return <div className="rounded-md border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className={`text-lg font-bold ${cls}`}>{value}</div></div>;
}
