import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { serverQuery } from "@/lib/server-api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/crud";
import { fmtBRL, fmtDate, fmtHours } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/minhas-horas")({ component: Page });

function Page() {
  const { profile, user } = useAuth();
  const { t } = useI18n();
  const fid = profile?.funcionario_id;
  const tenantId = user?.tenant_id ?? "";
  const { data: horas = [] } = useQuery({
    queryKey: ["minhas-horas", fid, tenantId],
    enabled: !!fid && !!tenantId,
    queryFn: async () => (await serverQuery({
      sql: `SELECT h.*, o.nome AS obra_nome
            FROM horas_trabalhadas h
            LEFT JOIN obras o ON o.id = h.obra_id AND o.tenant_id = h.tenant_id
            WHERE h.funcionario_id = ? AND h.tenant_id = ?
            ORDER BY h.data DESC`,
      values: [fid!, tenantId],
    })) ?? [],
  });

  if (!fid) return <div className="p-4 text-muted-foreground">{t("Seu usuário ainda não foi vinculado a um funcionário. Peça ao Proprietário.")}</div>;

  const total = horas.reduce((s,h:any)=>s+Number(h.horas),0);
  const valor = horas.reduce((s,h:any)=>s+Number(h.valor_total),0);

  return (
    <div>
      <PageHeader title="Minhas Horas" />
      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("Total horas")}</div><div className="text-xl font-bold">{fmtHours(total)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">{t("Total a receber")}</div><div className="text-xl font-bold text-success">{fmtBRL(valor)}</div></CardContent></Card>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Data")}</TableHead><TableHead>{t("Obra")}</TableHead><TableHead>{t("Horas")}</TableHead><TableHead>{t("Valor")}</TableHead><TableHead>{t("Descrição")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {horas.map((h:any)=>(
              <TableRow key={h.id}><TableCell>{fmtDate(h.data)}</TableCell><TableCell>{h.obra_nome}</TableCell><TableCell>{fmtHours(h.horas)}</TableCell><TableCell>{fmtBRL(h.valor_total)}</TableCell><TableCell className="text-xs">{h.descricao}</TableCell></TableRow>
            ))}
            {horas.length===0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("Sem registros.")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
