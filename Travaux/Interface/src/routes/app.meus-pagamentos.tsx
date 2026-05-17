import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { serverQuery } from "@/lib/server-api";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/crud";
import { fmtBRL, fmtDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/meus-pagamentos")({ component: Page });

function Page() {
  const { profile, user } = useAuth();
  const { t, tEnum } = useI18n();
  const fid = profile?.funcionario_id;
  const tenantId = user?.tenant_id ?? "";
  const { data: pags = [] } = useQuery({
    queryKey: ["meus-pagamentos", fid, tenantId],
    enabled: !!fid && !!tenantId,
    queryFn: async () => (await serverQuery({
      sql: `SELECT *
            FROM pagamentos
            WHERE funcionario_id = ? AND tenant_id = ?
            ORDER BY data_pagamento DESC`,
      values: [fid!, tenantId],
    })) ?? [],
  });

  if (!fid) return <div className="p-4 text-muted-foreground">{t("Seu usuário ainda não foi vinculado a um funcionário. Peça ao Proprietário.")}</div>;

  return (
    <div>
      <PageHeader title="Meus Pagamentos" />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Data")}</TableHead><TableHead>{t("Período")}</TableHead><TableHead>{t("Valor")}</TableHead><TableHead>{t("Forma")}</TableHead><TableHead>{t("Status")}</TableHead></TableRow></TableHeader>
          <TableBody>
            {pags.map((p:any)=>(
              <TableRow key={p.id}><TableCell>{fmtDate(p.data_pagamento)}</TableCell><TableCell>{fmtDate(p.periodo_inicio)} → {fmtDate(p.periodo_fim)}</TableCell><TableCell>{fmtBRL(p.valor)}</TableCell><TableCell className="capitalize">{tEnum(p.forma)}</TableCell><TableCell><Badge className={p.status==="pago"?"bg-success/20 text-success":"bg-warning/20"}>{tEnum(p.status)}</Badge></TableCell></TableRow>
            ))}
            {pags.length===0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("Sem pagamentos.")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
