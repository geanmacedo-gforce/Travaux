import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RequireAuth } from "@/components/RequireAuth";
import { PageHeader } from "@/components/crud";
import { useAuth } from "@/lib/auth-context";
import { serverQuery, serverQueryOne } from "@/lib/server-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/app/financeiro")({ component: Page });

type BillingRow = {
  billing_email: string | null;
  payment_method: string | null;
  payment_last4: string | null;
};

type InvoiceRow = {
  id: string;
  referencia: string;
  valor: number;
  moeda: string;
  status: string;
  pago_em: string | null;
};

function formatMoney(value: number, currency: string) {
  const n = Number(value || 0);
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(n);
}

function Page() {
  const { user } = useAuth();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();

  const [billingEmail, setBillingEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentLast4, setPaymentLast4] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ensureSchema = async () => {
      if (!tenantId) return;

      try {
        await serverQuery({ sql: "ALTER TABLE tenants ADD COLUMN billing_email VARCHAR(255) NULL" });
      } catch {
        // no-op when column exists
      }
      try {
        await serverQuery({ sql: "ALTER TABLE tenants ADD COLUMN payment_method VARCHAR(120) NULL" });
      } catch {
        // no-op when column exists
      }
      try {
        await serverQuery({ sql: "ALTER TABLE tenants ADD COLUMN payment_last4 VARCHAR(4) NULL" });
      } catch {
        // no-op when column exists
      }

      await serverQuery({
        sql: `CREATE TABLE IF NOT EXISTS tenant_faturas_servico (
          id VARCHAR(36) PRIMARY KEY,
          tenant_id VARCHAR(36) NOT NULL,
          referencia VARCHAR(20) NOT NULL,
          valor DECIMAL(10,2) NOT NULL,
          moeda VARCHAR(10) NOT NULL DEFAULT 'BRL',
          status VARCHAR(20) NOT NULL DEFAULT 'pending',
          pago_em DATETIME NULL,
          criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_tenant_faturas_servico_tenant_ref (tenant_id, referencia)
        )`,
      });
    };

    void ensureSchema();
  }, [tenantId]);

  const { data: billing, isLoading: loadingBilling } = useQuery({
    queryKey: ["tenant-billing", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      return serverQueryOne<BillingRow>({
        sql: "SELECT billing_email, payment_method, payment_last4 FROM tenants WHERE id = ? LIMIT 1",
        values: [tenantId],
      });
    },
  });

  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["tenant-invoices-paid", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      return (await serverQuery({
        sql: `SELECT id, referencia, valor, moeda, status, pago_em
              FROM tenant_faturas_servico
              WHERE tenant_id = ? AND status = 'paid'
              ORDER BY COALESCE(pago_em, criado_em) DESC`,
        values: [tenantId],
      })) as InvoiceRow[];
    },
  });

  useEffect(() => {
    if (!billing) return;
    setBillingEmail(billing.billing_email ?? "");
    setPaymentMethod(billing.payment_method ?? "");
    setPaymentLast4(billing.payment_last4 ?? "");
  }, [billing]);

  const saveBilling = async () => {
    if (!tenantId) return toast.error("Tenant não identificado.");

    setSaving(true);
    try {
      await serverQuery({
        sql: "UPDATE tenants SET billing_email = ?, payment_method = ?, payment_last4 = ? WHERE id = ?",
        values: [billingEmail.trim() || null, paymentMethod.trim() || null, paymentLast4.trim() || null, tenantId],
      });
      await qc.invalidateQueries({ queryKey: ["tenant-billing", tenantId] });
      toast.success("Dados financeiros atualizados.");
    } catch (error) {
      toast.error((error as Error).message || "Falha ao salvar dados financeiros.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireAuth roles={["proprietario", "admin"]}>
      <div className="space-y-6">
        <PageHeader title="Financeiro" />

        <Card>
          <CardHeader>
            <CardTitle>Meio de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing-email">E-mail de cobrança</Label>
                <Input
                  id="billing-email"
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  disabled={loadingBilling}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-method">Método</Label>
                <Input
                  id="payment-method"
                  placeholder="Cartão, Pix, Boleto..."
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={loadingBilling}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payment-last4">Final do cartão</Label>
                <Input
                  id="payment-last4"
                  placeholder="1234"
                  maxLength={4}
                  value={paymentLast4}
                  onChange={(e) => setPaymentLast4(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  disabled={loadingBilling}
                />
              </div>
            </div>

            <Button onClick={saveBilling} disabled={saving || loadingBilling}>
              {saving ? "Salvando..." : "Salvar dados"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Faturas pagas do Travaux</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Referência</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loadingInvoices && invoices.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      Nenhuma fatura paga registrada até o momento.
                    </TableCell>
                  </TableRow>
                )}
                {invoices.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.referencia}</TableCell>
                    <TableCell>{formatMoney(row.valor, row.moeda)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{row.status}</Badge>
                    </TableCell>
                    <TableCell>{row.pago_em ? new Date(row.pago_em).toLocaleString("pt-BR") : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </RequireAuth>
  );
}
