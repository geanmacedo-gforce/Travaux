import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { serverQuery } from "@/lib/server-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, FormDialog, ConfirmDelete } from "@/components/crud";
import { fmtBRL, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Pencil, Wallet, Building2, TrendingUp } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/pagamentos-recebidos")({ component: Page });

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function Page() {
  const { user } = useAuth();
  const { t, tEnum } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const today = new Date();
  const [inicio, setInicio] = useState(formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [fim, setFim] = useState(formatLocalDate(new Date(today.getFullYear(), today.getMonth() + 1, 0)));
  const [obraIdFilter, setObraIdFilter] = useState("all");
  const [view, setView] = useState<"resumo" | "historico">("resumo");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({
    obra_id: "",
    valor: 0,
    data_recebimento: formatLocalDate(today),
    forma: "pix",
    observacoes: "",
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-pag-rec", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT id, nome, valor_contratado, status FROM obras WHERE tenant_id = ? ORDER BY nome",
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });

  const { data: recebimentos = [] } = useQuery({
    queryKey: ["pag-rec", tenantId],
    queryFn: async () => {
      await serverQuery({
        sql: `CREATE TABLE IF NOT EXISTS pagamentos_recebidos (
              id CHAR(36) NOT NULL,
              tenant_id CHAR(36) NOT NULL,
              obra_id CHAR(36) NOT NULL,
              valor DECIMAL(14,2) NOT NULL,
              data_recebimento DATE NOT NULL,
              forma VARCHAR(30) NULL,
              observacoes TEXT NULL,
              created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
              updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (id),
              KEY idx_pag_rec_tenant_id (tenant_id),
              KEY idx_pag_rec_obra_data (obra_id, data_recebimento),
              CONSTRAINT fk_pag_rec_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
              CONSTRAINT fk_pag_rec_obra_tenant FOREIGN KEY (tenant_id, obra_id) REFERENCES obras(tenant_id, id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
      });

      return (await serverQuery({
        sql: `SELECT p.*, o.nome AS obra_nome
              FROM pagamentos_recebidos p
              LEFT JOIN obras o ON o.id = p.obra_id AND o.tenant_id = p.tenant_id
              WHERE p.tenant_id = ?
              ORDER BY p.data_recebimento DESC, p.created_at DESC`,
        values: [tenantId],
      })) ?? [];
    },
    enabled: Boolean(tenantId),
  });

  const recebimentosFiltrados = useMemo(() => {
    return recebimentos.filter((r: any) => {
      const data = String(r.data_recebimento ?? "").slice(0, 10);
      const emIntervalo = data >= inicio && data <= fim;
      const passaObra = obraIdFilter === "all" || r.obra_id === obraIdFilter;
      return emIntervalo && passaObra;
    });
  }, [recebimentos, inicio, fim, obraIdFilter]);

  const totalRecebidoPorObra = useMemo(() => {
    const map = new Map<string, number>();
    recebimentosFiltrados.forEach((r: any) => {
      map.set(r.obra_id, (map.get(r.obra_id) ?? 0) + Number(r.valor ?? 0));
    });
    return map;
  }, [recebimentosFiltrados]);

  const linhas = useMemo(() => {
    return obras
      .filter((o: any) => obraIdFilter === "all" || o.id === obraIdFilter)
      .map((o: any) => {
        const totalContratado = Number(o.valor_contratado ?? 0);
        const totalRecebido = totalRecebidoPorObra.get(o.id) ?? 0;
        const saldo = totalContratado - totalRecebido;
        return {
          obra: o,
          totalContratado,
          totalRecebido,
          saldo,
        };
      });
  }, [obras, obraIdFilter, totalRecebidoPorObra]);

  const totalizadores = useMemo(() => {
    const totalContratado = linhas.reduce((s: number, l: any) => s + Number(l.totalContratado), 0);
    const totalRecebido = linhas.reduce((s: number, l: any) => s + Number(l.totalRecebido), 0);
    const totalSaldo = linhas.reduce((s: number, l: any) => s + Number(l.saldo), 0);
    return { totalContratado, totalRecebido, totalSaldo };
  }, [linhas]);

  const openNew = (obraId?: string, valorSugestao?: number) => {
    setEditId(null);
    setForm({
      obra_id: obraId ?? (obraIdFilter !== "all" ? obraIdFilter : ""),
      valor: valorSugestao && valorSugestao > 0 ? Number(valorSugestao.toFixed(2)) : 0,
      data_recebimento: formatLocalDate(today),
      forma: "pix",
      observacoes: "",
    });
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setEditId(r.id);
    setForm({
      obra_id: r.obra_id,
      valor: r.valor,
      data_recebimento: String(r.data_recebimento).slice(0, 10),
      forma: r.forma ?? "pix",
      observacoes: r.observacoes ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    if (!form.obra_id) return toast.error(t("Selecione a obra."));
    if (!Number(form.valor) || Number(form.valor) <= 0) return toast.error(t("Informe um valor válido."));

    const payload = {
      obra_id: form.obra_id,
      valor: Number(form.valor),
      data_recebimento: form.data_recebimento,
      forma: form.forma || null,
      observacoes: form.observacoes || null,
    };

    try {
      if (editId) {
        await serverQuery({
          sql: `UPDATE pagamentos_recebidos
                SET obra_id = ?, valor = ?, data_recebimento = ?, forma = ?, observacoes = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            payload.obra_id,
            payload.valor,
            payload.data_recebimento,
            payload.forma,
            payload.observacoes,
            editId,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO pagamentos_recebidos (id, tenant_id, obra_id, valor, data_recebimento, forma, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            payload.obra_id,
            payload.valor,
            payload.data_recebimento,
            payload.forma,
            payload.observacoes,
          ],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }

    toast.success(editId ? t("Recebimento atualizado") : t("Recebimento registrado"));
    setOpen(false);
    setEditId(null);
    qc.invalidateQueries({ queryKey: ["pag-rec"] });
  };

  const del = async (id: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "DELETE FROM pagamentos_recebidos WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Recebimento excluído"));
    qc.invalidateQueries({ queryKey: ["pag-rec"] });
  };

  return (
    <div>
      <PageHeader title="Pagamentos Recebidos" action={<Button onClick={() => openNew()}>{t("Novo recebimento")}</Button>} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t("Total Contratado")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtBRL(totalizadores.totalContratado)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              {t("Total Recebido")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtBRL(totalizadores.totalRecebido)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("Saldo a Receber")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtBRL(totalizadores.totalSaldo)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>{t("Data início")}</Label>
              <Input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <Label>{t("Data fim")}</Label>
              <Input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
            </div>
            <div>
              <Label>{t("Obra")}</Label>
              <Select value={obraIdFilter} onValueChange={setObraIdFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("Todas as obras")}</SelectItem>
                  {obras.map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button variant={view === "resumo" ? "default" : "outline"} onClick={() => setView("resumo")}>{t("Resumo")}</Button>
              <Button variant={view === "historico" ? "default" : "outline"} onClick={() => setView("historico")}>{t("Histórico")}</Button>
            </div>
          </div>

          {view === "resumo" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Obra")}</TableHead>
                    <TableHead>{t("Status")}</TableHead>
                    <TableHead>{t("Contratado")}</TableHead>
                    <TableHead>{t("Recebido (período)")}</TableHead>
                    <TableHead>{t("Saldo")}</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.map((l: any) => (
                    <TableRow key={l.obra.id}>
                      <TableCell className="font-medium">{l.obra.nome}</TableCell>
                      <TableCell>
                        <Badge className="bg-muted text-foreground capitalize">{tEnum(l.obra.status)}</Badge>
                      </TableCell>
                      <TableCell>{fmtBRL(l.totalContratado)}</TableCell>
                      <TableCell>{fmtBRL(l.totalRecebido)}</TableCell>
                      <TableCell>{fmtBRL(l.saldo)}</TableCell>
                      <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => openNew(l.obra.id, l.saldo)} aria-label={t("Registrar recebimento")}>
                                <Wallet className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("Registrar recebimento")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                    </TableRow>
                  ))}
                  {linhas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("Sem obras para o filtro selecionado.")}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("Data")}</TableHead>
                    <TableHead>{t("Obra")}</TableHead>
                    <TableHead>{t("Valor")}</TableHead>
                    <TableHead>{t("Forma")}</TableHead>
                    <TableHead>{t("Observações")}</TableHead>
                    <TableHead className="text-right"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recebimentosFiltrados.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell>{fmtDate(r.data_recebimento)}</TableCell>
                      <TableCell>{r.obra_nome}</TableCell>
                      <TableCell>{fmtBRL(r.valor)}</TableCell>
                      <TableCell className="capitalize">{tEnum(r.forma)}</TableCell>
                      <TableCell className="max-w-[360px] truncate">{r.observacoes || "-"}</TableCell>
                      <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={t("Editar recebimento")}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("Editar recebimento")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <ConfirmDelete onConfirm={() => del(r.id)} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {recebimentosFiltrados.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("Sem recebimentos no período.")}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FormDialog
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) setEditId(null); }}
        title={editId ? "Editar recebimento" : "Registrar recebimento"}
        onSubmit={save}
      >
        <div>
          <Label>{t("Obra")}</Label>
          <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v })}>
            <SelectTrigger><SelectValue placeholder={t("Selecione")} /></SelectTrigger>
            <SelectContent>
              {obras.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>{t("Valor")}</Label>
            <CurrencyInput value={form.valor} onValueChange={(value) => setForm({ ...form, valor: value })} />
          </div>
          <div>
            <Label>{t("Data")}</Label>
            <Input type="date" value={form.data_recebimento} onChange={(e) => setForm({ ...form, data_recebimento: e.target.value })} />
          </div>
        </div>

        <div>
          <Label>{t("Forma")}</Label>
          <Select value={form.forma} onValueChange={(v) => setForm({ ...form, forma: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="dinheiro">{t("Dinheiro")}</SelectItem>
              <SelectItem value="pix">Pix</SelectItem>
              <SelectItem value="transferencia">{t("Transferência")}</SelectItem>
              <SelectItem value="boleto">{t("Boleto")}</SelectItem>
              <SelectItem value="cartao">{t("Cartão")}</SelectItem>
              <SelectItem value="outro">{t("Outro")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t("Observações")}</Label>
          <Input value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
        </div>
      </FormDialog>
    </div>
  );
}
