import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { fmtBRL, fmtDate, fmtHours } from "@/lib/format";
import { toast } from "sonner";
import { Pencil, Clock, Wallet, Building2, ChevronDown, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/folha")({ component: Page });

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValePagamento(pagamento: any) {
  const obs = String(pagamento?.observacoes ?? "").toUpperCase();
  return obs.includes("[VALE]");
}

function getTipoPagamento(pagamento: any) {
  return isValePagamento(pagamento) ? "vale" : "pagamento";
}

function normalizeDate(value: any) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function isDateBetween(date: string, start: string, end: string) {
  return Boolean(date) && date >= start && date <= end;
}

function overlapsRange(startA: string, endA: string, startB: string, endB: string) {
  if (!startA || !endA || !startB || !endB) return false;
  return startA <= endB && endA >= startB;
}

function Page() {
  const { user } = useAuth();
  const { t, tEnum } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const today = new Date();
  const [inicio, setInicio] = useState(formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [fim, setFim] = useState(formatLocalDate(new Date(today.getFullYear(), today.getMonth()+1, 0)));
  const [funcFilters, setFuncFilters] = useState<Set<string>>(new Set());
  const [obraFilters, setObraFilters] = useState<Set<string>>(new Set());
  const [funcFilterOpen, setFuncFilterOpen] = useState(false);
  const [obraFilterOpen, setObraFilterOpen] = useState(false);
  const [view, setView] = useState<"folha" | "historico">("folha");
  const [folhaSortField, setFolhaSortField] = useState<string>("funcionario_nome");
  const [folhaSortDirection, setFolhaSortDirection] = useState<"asc" | "desc">("asc");
  const [histSortField, setHistSortField] = useState<string>("data_pagamento");
  const [histSortDirection, setHistSortDirection] = useState<"asc" | "desc">("desc");
  const [payOpen, setPayOpen] = useState(false);
  const [valeOpen, setValeOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [payForm, setPayForm] = useState<any>({ funcionario_id: "", valor: 0, data_pagamento: formatLocalDate(today), forma: "pix", periodo_inicio: inicio, periodo_fim: fim, status: "pago" });
  const [valeForm, setValeForm] = useState<any>({ funcionario_id: "", valor: 0, data_pagamento: formatLocalDate(today) });
  const funcFilterRef = useRef<HTMLDivElement | null>(null);
  const obraFilterRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (funcFilterOpen && funcFilterRef.current && !funcFilterRef.current.contains(target)) {
        setFuncFilterOpen(false);
      }
      if (obraFilterOpen && obraFilterRef.current && !obraFilterRef.current.contains(target)) {
        setObraFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [funcFilterOpen, obraFilterOpen]);

  const { data: funcs = [] } = useQuery({
    queryKey: ["funcs-folha", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT * FROM funcionarios WHERE tenant_id = ? AND status = ? ORDER BY nome",
      values: [tenantId, "ativo"],
    })) ?? [],
    enabled: Boolean(tenantId),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-folha", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT * FROM obras WHERE tenant_id = ? ORDER BY nome",
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: horas = [] } = useQuery({
    queryKey: ["horas-folha", inicio, fim, tenantId],
    queryFn: async () => (await serverQuery({
      sql: `SELECT h.*, f.nome AS funcionario_nome, o.nome AS obra_nome
            FROM horas_trabalhadas h
            LEFT JOIN funcionarios f ON f.id = h.funcionario_id AND f.tenant_id = h.tenant_id
            LEFT JOIN obras o ON o.id = h.obra_id AND o.tenant_id = h.tenant_id
            WHERE h.tenant_id = ? AND DATE(h.entrada) >= ? AND DATE(h.entrada) <= ?
            ORDER BY h.entrada DESC`,
      values: [tenantId, inicio, fim],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: pagamentos = [] } = useQuery({
    queryKey: ["pagamentos", tenantId],
    queryFn: async () => (await serverQuery({
      sql: `SELECT p.*, f.nome AS funcionario_nome
            FROM pagamentos p
            LEFT JOIN funcionarios f ON f.id = p.funcionario_id AND f.tenant_id = p.tenant_id
            WHERE p.tenant_id = ?
            ORDER BY p.created_at DESC`,
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });

  const horasFiltradas = useMemo(() => {
    return horas.filter((h: any) => {
      const passaFuncionario = funcFilters.size === 0 || funcFilters.has(h.funcionario_id);
      const passaObra = obraFilters.size === 0 || obraFilters.has(h.obra_id);
      return passaFuncionario && passaObra;
    });
  }, [horas, funcFilters, obraFilters]);

  const getValorHoraFuncionario = (funcionario: any) => {
    const valorBase = Number(funcionario?.valor ?? 0);
    if (funcionario?.tipo_remuneracao === "diaria") return valorBase / 8;
    if (funcionario?.tipo_remuneracao === "mensal") return valorBase / 220;
    return valorBase;
  };

  const pagamentosHistoricoFiltrados = useMemo(() => {
    return pagamentos.filter((p: any) => {
      const dataPagamento = normalizeDate(p.data_pagamento);
      const periodoInicio = normalizeDate(p.periodo_inicio);
      const periodoFim = normalizeDate(p.periodo_fim) || periodoInicio;
      const dataRef = dataPagamento || periodoFim;
      const emIntervalo = isDateBetween(dataRef, inicio, fim);
      const passaFuncionario = funcFilters.size === 0 || funcFilters.has(p.funcionario_id);
      return emIntervalo && passaFuncionario;
    });
  }, [pagamentos, inicio, fim, funcFilters]);

  const pagamentosPeriodo = useMemo(() => {
    return pagamentos.filter((p: any) => {
      const dataPagamento = normalizeDate(p.data_pagamento);
      const periodoInicio = normalizeDate(p.periodo_inicio);
      const periodoFim = normalizeDate(p.periodo_fim) || periodoInicio;
      const emIntervaloPorData = isDateBetween(dataPagamento, inicio, fim);
      const emIntervaloPorPeriodo = overlapsRange(periodoInicio, periodoFim, inicio, fim);
      const passaFuncionario = funcFilters.size === 0 || funcFilters.has(p.funcionario_id);
      return (emIntervaloPorData || emIntervaloPorPeriodo) && passaFuncionario;
    });
  }, [pagamentos, inicio, fim, funcFilters]);

  const pagamentosOrdenados = useMemo(() => {
    const sorted = [...pagamentosHistoricoFiltrados];
    sorted.sort((a: any, b: any) => {
      let av: any = a[histSortField];
      let bv: any = b[histSortField];

      if (histSortField === "data_pagamento" || histSortField === "periodo_inicio" || histSortField === "periodo_fim") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else if (histSortField === "valor") {
        av = Number(av ?? 0);
        bv = Number(bv ?? 0);
      } else if (histSortField === "tipo") {
        av = getTipoPagamento(a);
        bv = getTipoPagamento(b);
      } else if (histSortField === "forma") {
        av = String(a.forma ?? "").toLowerCase();
        bv = String(b.forma ?? "").toLowerCase();
      } else {
        av = String(av ?? "").toLowerCase();
        bv = String(bv ?? "").toLowerCase();
      }

      if (av < bv) return histSortDirection === "asc" ? -1 : 1;
      if (av > bv) return histSortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [pagamentosHistoricoFiltrados, histSortField, histSortDirection]);

  const resumoPagamentosPorFuncionario = useMemo(() => {
    const vales = new Map<string, number>();
    const pagamentos = new Map<string, number>();

    pagamentosPeriodo
      .filter((p: any) => p.status === "pago")
      .forEach((p: any) => {
        const valor = Number(p.valor || 0);
        if (isValePagamento(p)) {
          vales.set(p.funcionario_id, (vales.get(p.funcionario_id) ?? 0) + valor);
        } else {
          pagamentos.set(p.funcionario_id, (pagamentos.get(p.funcionario_id) ?? 0) + valor);
        }
      });

    return { vales, pagamentos };
  }, [pagamentosPeriodo]);

  const linhas = funcs.map((f:any) => {
    const hs = horasFiltradas.filter((h:any)=>h.funcionario_id===f.id);
    const valorHora = getValorHoraFuncionario(f);
    const totalH = hs.reduce((s:number,h:any)=>s+Number(h.horas),0);
    const totalBruto = totalH * valorHora;
    const totalVale = resumoPagamentosPorFuncionario.vales.get(f.id) ?? 0;
    const totalPagamentos = resumoPagamentosPorFuncionario.pagamentos.get(f.id) ?? 0;
    const saldo = totalBruto - totalVale - totalPagamentos;
    return { funcionario: f, totalH, totalBruto, totalVale, totalPagamentos, saldo };
  }).filter((l) => l.totalH > 0 && Number(l.saldo.toFixed(2)) !== 0);

  const linhasOrdenadas = useMemo(() => {
    const sorted = [...linhas];
    sorted.sort((a: any, b: any) => {
      let av: any;
      let bv: any;

      if (folhaSortField === "funcionario_nome") {
        av = String(a.funcionario?.nome ?? "").toLowerCase();
        bv = String(b.funcionario?.nome ?? "").toLowerCase();
      } else {
        av = Number(a[folhaSortField] ?? 0);
        bv = Number(b[folhaSortField] ?? 0);
      }

      if (av < bv) return folhaSortDirection === "asc" ? -1 : 1;
      if (av > bv) return folhaSortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [linhas, folhaSortField, folhaSortDirection]);

  const handleFolhaSort = (field: string) => {
    if (folhaSortField === field) {
      setFolhaSortDirection(folhaSortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setFolhaSortField(field);
    setFolhaSortDirection("asc");
  };

  const handleHistSort = (field: string) => {
    if (histSortField === field) {
      setHistSortDirection(histSortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setHistSortField(field);
    setHistSortDirection("asc");
  };

  const folhaSortIndicator = (field: string) => {
    if (folhaSortField !== field) return "↕";
    return folhaSortDirection === "asc" ? "↑" : "↓";
  };

  const histSortIndicator = (field: string) => {
    if (histSortField !== field) return "↕";
    return histSortDirection === "asc" ? "↑" : "↓";
  };

  const totalizadores = useMemo(() => {
    const totalHoras = linhas.reduce((s:number,l:any)=>s+Number(l.totalH),0);
    const totalReceber = linhas.reduce((s:number,l:any)=>s+Number(l.saldo),0);
    const obrasDiferentes = new Set(horasFiltradas.map((h:any)=>h.obra_id)).size;
    return { totalHoras, totalReceber, obrasDiferentes };
  }, [horasFiltradas, linhas]);

  const toggleFuncFilter = (funcId: string) => {
    const next = new Set(funcFilters);
    if (next.has(funcId)) next.delete(funcId);
    else next.add(funcId);
    setFuncFilters(next);
  };

  const toggleAllFuncFilters = () => {
    const allSelected = funcs.length > 0 && funcFilters.size === funcs.length;
    if (allSelected) {
      setFuncFilters(new Set());
      return;
    }
    setFuncFilters(new Set(funcs.map((f: any) => f.id)));
  };

  const toggleObraFilter = (obraId: string) => {
    const next = new Set(obraFilters);
    if (next.has(obraId)) next.delete(obraId);
    else next.add(obraId);
    setObraFilters(next);
  };

  const toggleAllObraFilters = () => {
    const allSelected = obras.length > 0 && obraFilters.size === obras.length;
    if (allSelected) {
      setObraFilters(new Set());
      return;
    }
    setObraFilters(new Set(obras.map((o: any) => o.id)));
  };

  const openPay = (l: any) => {
    setEditId(null);
    setPayForm({ funcionario_id: l.funcionario.id, valor: l.saldo, data_pagamento: formatLocalDate(today), forma: "pix", periodo_inicio: inicio, periodo_fim: fim, status: "pago" });
    setPayOpen(true);
  };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setPayForm({
      funcionario_id: p.funcionario_id, valor: p.valor,
      data_pagamento: normalizeDate(p.data_pagamento) || formatLocalDate(today),
      forma: p.forma ?? "pix",
      periodo_inicio: normalizeDate(p.periodo_inicio), periodo_fim: normalizeDate(p.periodo_fim),
      status: p.status ?? "pago",
    });
    setPayOpen(true);
  };
  const savePay = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const payload = {
      funcionario_id: payForm.funcionario_id,
      periodo_inicio: payForm.periodo_inicio, periodo_fim: payForm.periodo_fim,
      valor: Number(payForm.valor), status: payForm.status,
      data_pagamento: payForm.data_pagamento, forma: payForm.forma,
    };
    try {
      if (editId) {
        await serverQuery({
          sql: `UPDATE pagamentos
                SET funcionario_id = ?, periodo_inicio = ?, periodo_fim = ?, valor = ?, status = ?, data_pagamento = ?, forma = ?, observacoes = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            payload.funcionario_id,
            payload.periodo_inicio,
            payload.periodo_fim,
            payload.valor,
            payload.status,
            payload.data_pagamento,
            payload.forma,
            null,
            editId,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO pagamentos (id, tenant_id, funcionario_id, periodo_inicio, periodo_fim, valor, status, data_pagamento, forma, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            payload.funcionario_id,
            payload.periodo_inicio,
            payload.periodo_fim,
            payload.valor,
            payload.status,
            payload.data_pagamento,
            payload.forma,
            null,
          ],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(editId ? t("Pagamento atualizado") : t("Pagamento registrado"));
    setPayOpen(false); setEditId(null);
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  };
  const delPay = async (id: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "DELETE FROM pagamentos WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Pagamento excluído"));
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  };

  const openVale = (l: any) => {
    setValeForm({
      funcionario_id: l.funcionario.id,
      valor: 0,
      data_pagamento: formatLocalDate(today),
    });
    setValeOpen(true);
  };

  const saveVale = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    if (!valeForm.funcionario_id) return toast.error(t("Selecione um funcionário."));
    if (!Number(valeForm.valor) || Number(valeForm.valor) <= 0) return toast.error(t("Informe um valor de vale válido."));

    try {
      await serverQuery({
        sql: `INSERT INTO pagamentos (id, tenant_id, funcionario_id, periodo_inicio, periodo_fim, valor, status, data_pagamento, forma, observacoes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          crypto.randomUUID(),
          tenantId,
          valeForm.funcionario_id,
          inicio,
          fim,
          Number(valeForm.valor),
          "pago",
          valeForm.data_pagamento,
          "dinheiro",
          "[VALE] Adiantamento",
        ],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }

    toast.success(t("Vale registrado"));
    setValeOpen(false);
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
  };

  return (
    <div>
      <PageHeader title="Folha de Pagamento" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              {t("Total de Horas")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtHours(totalizadores.totalHoras)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              {t("Total a Pagar")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtBRL(totalizadores.totalReceber)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {t("Obras Diferentes")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalizadores.obrasDiferentes}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{t("Registros")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>{t("Data Início")}</Label>
              <Input type="date" value={inicio} onChange={(e)=>setInicio(e.target.value)} />
            </div>
            <div>
              <Label>{t("Data Fim")}</Label>
              <Input type="date" value={fim} onChange={(e)=>setFim(e.target.value)} />
            </div>
            <div ref={funcFilterRef} className="relative self-end">
              <Collapsible open={funcFilterOpen} onOpenChange={setFuncFilterOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>{t("Funcionário(s)")} {funcFilters.size > 0 && `(${funcFilters.size})`}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${funcFilterOpen ? "rotate-0" : "-rotate-90"}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background p-2 shadow-md">
                  {funcs.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t("Nenhum funcionário")}</div>
                  ) : (
                    <>
                      <button type="button" className="w-full text-left text-xs font-medium text-primary py-1" onClick={toggleAllFuncFilters}>
                        {funcFilters.size === funcs.length && funcs.length > 0 ? t("Limpar seleção") : t("Selecionar todos")}
                      </button>
                      {funcs.map((f: any) => (
                        <div key={f.id} className="flex items-center gap-2 py-1">
                          <Checkbox checked={funcFilters.has(f.id)} onCheckedChange={() => toggleFuncFilter(f.id)} />
                          <button type="button" className="text-sm text-left cursor-pointer flex-1" onClick={() => toggleFuncFilter(f.id)}>{f.nome}</button>
                        </div>
                      ))}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
            <div ref={obraFilterRef} className="relative self-end">
              <Collapsible open={obraFilterOpen} onOpenChange={setObraFilterOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span>{t("Obra(s)")} {obraFilters.size > 0 && `(${obraFilters.size})`}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${obraFilterOpen ? "rotate-0" : "-rotate-90"}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="absolute top-full left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-md border bg-background p-2 shadow-md">
                  {obras.length === 0 ? (
                    <div className="text-sm text-muted-foreground">{t("Nenhuma obra")}</div>
                  ) : (
                    <>
                      <button type="button" className="w-full text-left text-xs font-medium text-primary py-1" onClick={toggleAllObraFilters}>
                        {obraFilters.size === obras.length && obras.length > 0 ? t("Limpar seleção") : t("Selecionar todos")}
                      </button>
                      {obras.map((o: any) => (
                        <div key={o.id} className="flex items-center gap-2 py-1">
                          <Checkbox checked={obraFilters.has(o.id)} onCheckedChange={() => toggleObraFilter(o.id)} />
                          <button type="button" className="text-sm text-left cursor-pointer flex-1" onClick={() => toggleObraFilter(o.id)}>{o.nome}</button>
                        </div>
                      ))}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant={view === "folha" ? "default" : "outline"} onClick={() => setView("folha")}>{t("Exibir Folha")}</Button>
            <Button variant={view === "historico" ? "default" : "outline"} onClick={() => setView("historico")}>{t("Exibir Histórico")}</Button>
          </div>

          {view === "folha" ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("funcionario_nome")}>{t("Funcionário")} {folhaSortIndicator("funcionario_nome")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("totalH")}>{t("Horas")} {folhaSortIndicator("totalH")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("totalBruto")}>{t("Valor Total")} {folhaSortIndicator("totalBruto")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("totalVale")}>{t("Valor Vales")}{folhaSortIndicator("totalVale")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("saldo")}>{t("Saldo")} {folhaSortIndicator("saldo")}</Button></TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {linhasOrdenadas.map((l) => (
                    <TableRow key={l.funcionario.id}>
                      <TableCell className="font-medium">{l.funcionario.nome}</TableCell>
                      <TableCell>{fmtHours(l.totalH)}</TableCell>
                      <TableCell>{fmtBRL(l.totalBruto)}</TableCell>
                      <TableCell>{fmtBRL(l.totalVale)}</TableCell>
                      <TableCell>{fmtBRL(l.saldo)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" onClick={()=>openVale(l)} aria-label={t("Fazer vale")}>
                                  <Wallet className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("Fazer vale")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" onClick={()=>openPay(l)} aria-label={t("Marcar como pago")}>
                                  <Check className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("Marcar como pago")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {linhasOrdenadas.length===0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("Sem horas no período.")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("data_pagamento")}>{t("Data")} {histSortIndicator("data_pagamento")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("funcionario_nome")}>{t("Funcionário")} {histSortIndicator("funcionario_nome")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("periodo_inicio")}>{t("Período")} {histSortIndicator("periodo_inicio")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("valor")}>{t("Valor")} {histSortIndicator("valor")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("tipo")}>{t("Tipo")} {histSortIndicator("tipo")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("forma")}>{t("Forma")} {histSortIndicator("forma")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("status")}>{t("Status")} {histSortIndicator("status")}</Button></TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {pagamentosOrdenados.map((p:any)=>(
                    <TableRow key={p.id}>
                      <TableCell>{fmtDate(p.data_pagamento)}</TableCell>
                      <TableCell>{p.funcionario_nome}</TableCell>
                      <TableCell>{fmtDate(p.periodo_inicio)} → {fmtDate(p.periodo_fim)}</TableCell>
                      <TableCell>{fmtBRL(p.valor)}</TableCell>
                      <TableCell className="capitalize">{tEnum(getTipoPagamento(p))}</TableCell>
                      <TableCell className="capitalize">{tEnum(p.forma)}</TableCell>
                      <TableCell><Badge className={p.status==="pago"?"bg-success/20 text-success":"bg-warning/20"}>{tEnum(p.status)}</Badge></TableCell>
                      <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" onClick={()=>openEdit(p)} aria-label={t("Editar pagamento")}><Pencil className="h-4 w-4" /></Button>
                            </TooltipTrigger>
                            <TooltipContent>{t("Editar pagamento")}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <ConfirmDelete onConfirm={()=>delPay(p.id)} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {pagamentosOrdenados.length===0 && <TableRow><TableCell colSpan={8} className="text-center py-6 text-muted-foreground">{t("Sem pagamentos.")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FormDialog open={payOpen} onOpenChange={(o)=>{ setPayOpen(o); if(!o) setEditId(null); }} title={editId ? "Editar pagamento" : "Registrar pagamento"} onSubmit={savePay}>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Período início")}</Label><Input type="date" value={payForm.periodo_inicio} onChange={(e)=>setPayForm({...payForm,periodo_inicio:e.target.value})}/></div>
          <div><Label>{t("Período fim")}</Label><Input type="date" value={payForm.periodo_fim} onChange={(e)=>setPayForm({...payForm,periodo_fim:e.target.value})}/></div>
        </div>
        <div><Label>{t("Valor")}</Label><CurrencyInput value={payForm.valor} onValueChange={(value)=>setPayForm({...payForm,valor:value})}/></div>
        <div><Label>{t("Data")}</Label><Input type="date" value={payForm.data_pagamento} onChange={(e)=>setPayForm({...payForm,data_pagamento:e.target.value})}/></div>
        <div><Label>{t("Forma")}</Label>
          <Select value={payForm.forma} onValueChange={(v)=>setPayForm({...payForm,forma:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="dinheiro">{t("Dinheiro")}</SelectItem><SelectItem value="pix">Pix</SelectItem><SelectItem value="transferencia">{t("Transferência")}</SelectItem></SelectContent>
          </Select>
        </div>
        <div><Label>{t("Status")}</Label>
          <Select value={payForm.status} onValueChange={(v)=>setPayForm({...payForm,status:v})}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent><SelectItem value="pendente">{t("Pendente")}</SelectItem><SelectItem value="pago">{t("Pago")}</SelectItem></SelectContent>
          </Select>
        </div>
      </FormDialog>

      <FormDialog open={valeOpen} onOpenChange={setValeOpen} title="Registrar vale" onSubmit={saveVale}>
        <div>
          <Label>{t("Funcionário")}</Label>
          <Select value={valeForm.funcionario_id} onValueChange={(v)=>setValeForm({...valeForm, funcionario_id: v})}>
            <SelectTrigger><SelectValue placeholder={t("Selecione")}/></SelectTrigger>
            <SelectContent>
              {funcs.map((f:any)=><SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>{t("Valor do vale")}</Label><CurrencyInput value={valeForm.valor} onValueChange={(value)=>setValeForm({...valeForm,valor:value})}/></div>
        <div><Label>{t("Data")}</Label><Input type="date" value={valeForm.data_pagamento} onChange={(e)=>setValeForm({...valeForm,data_pagamento:e.target.value})}/></div>
      </FormDialog>
    </div>
  );
}
