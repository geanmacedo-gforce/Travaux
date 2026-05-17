import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { serverQuery } from "@/lib/server-api";
import { useAuth } from "@/lib/auth-context";
import { fmtBRL, fmtHours } from "@/lib/format";
import { Building2, Wallet, TrendingUp, TrendingDown, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/")({ component: DashboardPage });

const BRAND_PRIMARY = "#E8620A";
const BRAND_SECONDARY = "#1A1A1A";
const COLORS = ["#E8620A","#1A1A1A","#9CA3AF","#F2A368","#4B5563","#FBBF24"];

function DashboardPage() {
  const { role, profile, user } = useAuth();
  const { t } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const isOwner = role === "proprietario";
  const isFunc = role === "funcionario";

  const { data } = useQuery({
    queryKey: ["dashboard", role, profile?.funcionario_id, tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      if (isFunc) {
        const fid = profile?.funcionario_id;
        if (!fid) return { funcMode: true, horas: [], pagPendente: 0, obras: [] as any[] };
        const inicioMes = new Date(); inicioMes.setDate(1);
        const horas = await serverQuery({
          sql: `SELECT h.*, o.nome AS obra_nome
                FROM horas_trabalhadas h
                LEFT JOIN obras o ON o.id = h.obra_id AND o.tenant_id = h.tenant_id
                WHERE h.tenant_id = ? AND h.funcionario_id = ? AND h.data >= ?
                ORDER BY h.data DESC`,
          values: [tenantId, fid, inicioMes.toISOString().slice(0, 10)],
        });
        const totalHoras = (horas ?? []).reduce((s, h: any) => s + Number(h.horas), 0);
        const valorReceber = (horas ?? []).reduce((s, h: any) => s + Number(h.valor_total), 0);
        const obrasIds = Array.from(new Set((horas ?? []).map((h: any) => h.obra_id)));
        return { funcMode: true, horas: horas ?? [], totalHoras, valorReceber, obrasCount: obrasIds.length };
      }
      const [obras, horas, mats, desp, funcs] = await Promise.all([
        serverQuery({ sql: "SELECT * FROM obras WHERE tenant_id = ?", values: [tenantId] }),
        serverQuery({
          sql: `SELECT h.*, f.nome AS funcionario_nome
                FROM horas_trabalhadas h
                LEFT JOIN funcionarios f ON f.id = h.funcionario_id AND f.tenant_id = h.tenant_id
                WHERE h.tenant_id = ?`,
          values: [tenantId],
        }),
        serverQuery({ sql: "SELECT * FROM materiais_usados WHERE tenant_id = ?", values: [tenantId] }),
        serverQuery({ sql: "SELECT * FROM despesas WHERE tenant_id = ?", values: [tenantId] }),
        serverQuery({ sql: "SELECT id, nome FROM funcionarios WHERE tenant_id = ?", values: [tenantId] }),
      ]);
      return { obras: obras ?? [], horas: horas ?? [], mats: mats ?? [], desp: desp ?? [], funcs: funcs ?? [] };
    },
  });

  if (isFunc) {
    const d: any = data ?? {};
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">{t("Olá, {name}!", { name: profile?.nome.split(" ")[0] ?? "" })}</h1>
        <div className="grid md:grid-cols-3 gap-4">
          <StatCard icon={Clock} label={t("Horas no mês")} value={fmtHours(d.totalHoras ?? 0)} />
          <StatCard icon={Wallet} label={t("Valor a receber")} value={fmtBRL(d.valorReceber ?? 0)} />
          <StatCard icon={Building2} label={t("Obras alocadas")} value={d.obrasCount ?? 0} />
        </div>
        <Card>
          <CardHeader><CardTitle>{t("Últimos registros")}</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {(d.horas ?? []).slice(0, 8).map((h: any) => (
                <div key={h.id} className="py-2 flex justify-between text-sm">
                  <div><div className="font-medium">{h.obra_nome}</div><div className="text-muted-foreground text-xs">{new Date(h.data + "T00:00:00").toLocaleDateString()} · {h.descricao || "-"}</div></div>
                  <div className="text-right"><div>{fmtHours(h.horas)}</div><div className="text-xs text-muted-foreground">{fmtBRL(h.valor_total)}</div></div>
                </div>
              ))}
              {(d.horas ?? []).length === 0 && <div className="py-6 text-center text-muted-foreground text-sm">{t("Nenhuma hora registrada este mês.")}</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const obras = data?.obras ?? [];
  const horas = data?.horas ?? [];
  const mats = data?.mats ?? [];
  const desp = data?.desp ?? [];
  const funcs = data?.funcs ?? [];

  const fat = obras.reduce((s, o: any) => s + Number(o.valor_contratado), 0);
  const totalMO = horas.reduce((s, h: any) => s + Number(h.valor_total), 0);
  const totalMat = mats.reduce((s, m: any) => s + Number(m.valor_total), 0);
  const byCat = (cat: string) => desp.filter((d: any) => d.categoria === cat).reduce((s, d: any) => s + Number(d.valor), 0);
  const totComb = byCat("combustivel"), totAlim = byCat("alimentacao"), totHosp = byCat("hospedagem"), totOut = byCat("outros");
  const totalGastos = totalMO + totalMat + totComb + totAlim + totHosp + totOut;
  const lucro = fat - totalGastos;
  const obrasAtivas = obras.filter((o: any) => o.status === "em_andamento").length;

  const obrasChart = obras.slice(0, 6).map((o: any) => {
    const gO = horas.filter((h: any) => h.obra_id === o.id).reduce((s: number, h: any) => s + Number(h.valor_total), 0)
      + mats.filter((m: any) => m.obra_id === o.id).reduce((s: number, m: any) => s + Number(m.valor_total), 0)
      + desp.filter((d: any) => d.obra_id === o.id).reduce((s: number, d: any) => s + Number(d.valor), 0);
    return { nome: o.nome.slice(0, 14), Faturado: Number(o.valor_contratado), Gastos: gO };
  });

  const pie = [
    { name: t("Mão de obra"), value: totalMO },
    { name: t("Materiais"), value: totalMat },
    { name: t("Combustível"), value: totComb },
    { name: t("Alimentação"), value: totAlim },
    { name: t("Hospedagem"), value: totHosp },
    { name: t("Outros"), value: totOut },
  ].filter((p) => p.value > 0);

  const horasPorFunc = funcs.map((f: any) => ({
    nome: f.nome.split(" ")[0],
    horas: horas.filter((h: any) => h.funcionario_id === f.id).reduce((s: number, h: any) => s + Number(h.horas), 0),
  })).sort((a, b) => b.horas - a.horas).slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t("Dashboard")}</h1>
      <div className="grid md:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label={t("Faturamento")} value={fmtBRL(fat)} />
        {isOwner && <StatCard icon={Wallet} label={t("Lucro líquido")} value={fmtBRL(lucro)} accent={lucro >= 0 ? "success" : "destructive"} />}
        <StatCard icon={TrendingDown} label={t("Total gastos")} value={fmtBRL(totalGastos)} />
        <StatCard icon={Building2} label={t("Obras ativas")} value={obrasAtivas} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t("Faturamento vs Gastos por obra")}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><BarChart data={obrasChart}><XAxis dataKey="nome" fontSize={12} /><YAxis fontSize={12} /><Tooltip formatter={(v: any) => fmtBRL(Number(v))} /><Bar dataKey="Faturado" fill={BRAND_PRIMARY} /><Bar dataKey="Gastos" fill={BRAND_SECONDARY} /></BarChart></ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("Breakdown de gastos")}</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>{pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Legend /><Tooltip formatter={(v: any) => fmtBRL(Number(v))} /></PieChart></ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle>{t("Obras ativas")}</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {obras.filter((o: any) => o.status === "em_andamento").slice(0, 6).map((o: any) => {
                const gO = horas.filter((h: any) => h.obra_id === o.id).reduce((s: number, h: any) => s + Number(h.valor_total), 0)
                  + mats.filter((m: any) => m.obra_id === o.id).reduce((s: number, m: any) => s + Number(m.valor_total), 0)
                  + desp.filter((d: any) => d.obra_id === o.id).reduce((s: number, d: any) => s + Number(d.valor), 0);
                const lucroO = Number(o.valor_contratado) - gO;
                return (
                  <div key={o.id} className="py-2 flex justify-between text-sm">
                    <div className="font-medium">{o.nome}</div>
                    {isOwner && <div className={lucroO >= 0 ? "text-success" : "text-destructive"}>{fmtBRL(lucroO)}</div>}
                  </div>
                );
              })}
              {obras.filter((o: any) => o.status === "em_andamento").length === 0 && <div className="py-4 text-center text-muted-foreground text-sm">{t("Nenhuma obra em andamento.")}</div>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t("Top funcionários por horas")}</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y">
              {horasPorFunc.map((f) => (
                <div key={f.nome} className="py-2 flex justify-between text-sm">
                  <div>{f.nome}</div><div className="font-medium">{fmtHours(f.horas)}</div>
                </div>
              ))}
              {horasPorFunc.length === 0 && <div className="py-4 text-center text-muted-foreground text-sm">{t("Sem dados.")}</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: "success" | "destructive" }) {
  const cls = accent === "success" ? "text-success" : accent === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/10 grid place-items-center text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-xl font-bold ${cls}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
