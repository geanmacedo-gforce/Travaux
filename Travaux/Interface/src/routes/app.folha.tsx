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
import { Pencil, Clock, Wallet, Building2, ChevronDown, Check, MessageSquare, CheckCheck, XCircle, RotateCcw, Users } from "lucide-react";
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

const MESES_PT = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

function periodoLabel(yyyymm: string): string {
  const y = parseInt(yyyymm.slice(0, 4));
  const m = parseInt(yyyymm.slice(4, 6)) - 1;
  return `${MESES_PT[m]} ${y}`;
}

function periodoFromDate(dateStr: string): string {
  const raw = String(dateStr ?? "").trim();
  if (!raw) return "";

  // Avoid timezone shifts for values like "YYYY-MM-DD" by extracting directly.
  const yyyyMmDashed = raw.match(/^(\d{4})-(\d{2})/);
  if (yyyyMmDashed) return `${yyyyMmDashed[1]}${yyyyMmDashed[2]}`;

  const yyyyMmCompact = raw.match(/^(\d{4})(\d{2})$/);
  if (yyyyMmCompact) return `${yyyyMmCompact[1]}${yyyyMmCompact[2]}`;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toNonNegativeMoney(value: any): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n);
}

function isValePagamento(pagamento: any) {
  const obs = String(pagamento?.observacoes ?? "").toUpperCase();
  return obs.includes("[VALE]");
}

function getTipoPagamento(pagamento: any) {
  return isValePagamento(pagamento) ? "vale" : "pagamento";
}

function buildMensagemConfirmacaoRecebimento(titulo: string, detalhes: string[]) {
  const body = detalhes.filter(Boolean).join("\n");
  return `${titulo}\n\n${body}\n\nVocê aprova esse recebimento?\n\n1 - SIM\n2 - NÃO`;
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
  const [valeForm, setValeForm] = useState<any>({ funcionario_id: "", valor: 0, data_pagamento: formatLocalDate(today), periodo_inicio: "", periodo_fim: "" });
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
  const { data: folhaData = [], error: folhaError } = useQuery({
    queryKey: ["folha", inicio, fim, tenantId],
    queryFn: async () => {
      const result = await serverQuery({
        sql: `SELECT
              f.id AS funcionario_id,
              f.nome AS funcionario_nome,
              DATE_FORMAT(h.entrada, '%Y%m') AS period,
              COUNT(DISTINCT h.obra_id) AS obras_distintas,
              ROUND(SUM(h.horas), 4) AS total_horas,
              ROUND(SUM(h.horas) * CASE f.tipo_remuneracao
                WHEN 'diaria' THEN f.valor / 8
                WHEN 'mensal' THEN f.valor / 220
                ELSE f.valor
              END, 2) AS total_bruto,
              COALESCE(MAX(pag.total_vales), 0) AS total_vales,
              COALESCE(MAX(pag.total_pagamentos), 0) AS total_pagamentos,
              LEAST(
                ROUND(SUM(h.horas) * CASE f.tipo_remuneracao
                  WHEN 'diaria' THEN f.valor / 8
                  WHEN 'mensal' THEN f.valor / 220
                  ELSE f.valor
                END, 2),
                ROUND(
                  ROUND(SUM(h.horas) * CASE f.tipo_remuneracao
                    WHEN 'diaria' THEN f.valor / 8
                    WHEN 'mensal' THEN f.valor / 220
                    ELSE f.valor
                  END, 2)
                  - COALESCE(MAX(pag.total_vales), 0)
                  - COALESCE(MAX(pag.total_pagamentos), 0)
                , 2)
              ) AS saldo
            FROM horas_trabalhadas h
            LEFT JOIN funcionarios f ON f.id = h.funcionario_id AND f.tenant_id = h.tenant_id
            LEFT JOIN (
              SELECT
                funcionario_id,
                DATE_FORMAT(COALESCE(periodo_inicio, data_pagamento), '%Y%m') AS period,
                ROUND(SUM(ABS(valor)), 2) AS total_vales,
                0 AS total_pagamentos
              FROM pagamentos
              WHERE tenant_id = ? AND status = 'pago'
              GROUP BY funcionario_id, DATE_FORMAT(COALESCE(periodo_inicio, data_pagamento), '%Y%m')
            ) pag ON pag.funcionario_id = h.funcionario_id AND pag.period = DATE_FORMAT(h.entrada, '%Y%m')
            WHERE h.tenant_id = ? AND DATE(h.entrada) >= ? AND DATE(h.entrada) <= ?
            GROUP BY f.id, f.nome, f.valor, f.tipo_remuneracao, DATE_FORMAT(h.entrada, '%Y%m')
            HAVING SUM(h.horas) > 0
            ORDER BY f.nome, period`,
        values: [tenantId, tenantId, inicio, fim],
      });
      if (!result) return [];
      return result;
    },
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

  // Linhas da folha: calculadas no banco, filtradas aqui por funcionário
  const linhas = useMemo(() => {
    return folhaData
      .filter((row: any) => funcFilters.size === 0 || funcFilters.has(row.funcionario_id))
      .map((row: any) => ({
        funcionario: funcs.find((f: any) => f.id === row.funcionario_id) ?? { id: row.funcionario_id, nome: row.funcionario_nome },
        period: row.period,
        totalH: Number(row.total_horas),
        totalBruto: Number(row.total_bruto),
        totalVale: Number(row.total_vales),
        totalPagamentos: Number(row.total_pagamentos),
        saldo: Number(row.saldo),
        obrasDist: Number(row.obras_distintas ?? 0),
      }));
  }, [folhaData, funcFilters, funcs]);

  const linhasOrdenadas = useMemo(() => {
    const sorted = [...linhas];
    sorted.sort((a: any, b: any) => {
      let av: any;
      let bv: any;

      if (folhaSortField === "funcionario_nome") {
        av = String(a.funcionario?.nome ?? "").toLowerCase();
        bv = String(b.funcionario?.nome ?? "").toLowerCase();
      } else if (folhaSortField === "period") {
        av = a.period ?? "";
        bv = b.period ?? "";
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
    const totalHoras = linhas.reduce((s: number, l: any) => s + Number(l.totalH), 0);
    const totalReceber = linhas.reduce((s: number, l: any) => s + Number(l.saldo), 0);
    const funcionariosDiferentes = new Set(linhas.map((l: any) => l.funcionario.id)).size;
    return { totalHoras, totalReceber, funcionariosDiferentes };
  }, [linhas]);

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
    const py = parseInt(l.period.slice(0, 4));
    const pm = parseInt(l.period.slice(4, 6)) - 1;
    const pInicio = formatLocalDate(new Date(py, pm, 1));
    const pFim = formatLocalDate(new Date(py, pm + 1, 0));
    setPayForm({ funcionario_id: l.funcionario.id, valor: l.saldo, data_pagamento: formatLocalDate(today), forma: "pix", periodo_inicio: pInicio, periodo_fim: pFim, status: "pago" });
    setPayOpen(true);
  };
  const openEdit = (p: any) => {
    setEditId(p.id);
    setPayForm({
      funcionario_id: p.funcionario_id, valor: toNonNegativeMoney(p.valor),
      data_pagamento: normalizeDate(p.data_pagamento) || formatLocalDate(today),
      forma: p.forma ?? "pix",
      periodo_inicio: normalizeDate(p.periodo_inicio), periodo_fim: normalizeDate(p.periodo_fim),
      status: p.status ?? "pago",
    });
    setPayOpen(true);
  };
  const savePay = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const valorPay = Number(payForm.valor ?? 0);
    if (!Number.isFinite(valorPay)) return toast.error(t("Informe um valor válido."));
    if (valorPay < 0) return toast.error(t("Pagamento não pode ter valor negativo."));
    const payload = {
      funcionario_id: payForm.funcionario_id,
      periodo_inicio: payForm.periodo_inicio, periodo_fim: payForm.periodo_fim,
      valor: toNonNegativeMoney(payForm.valor), status: payForm.status,
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
        const newId = crypto.randomUUID();
        await serverQuery({
          sql: `INSERT INTO pagamentos (id, tenant_id, funcionario_id, periodo_inicio, periodo_fim, valor, status, data_pagamento, forma, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            newId,
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
        // Enfileirar notificação WhatsApp para o funcionário
        const func = funcs.find((f: any) => f.id === payload.funcionario_id);
        if (func?.telefone) {
          const periodo = `${fmtDate(payload.periodo_inicio)} → ${fmtDate(payload.periodo_fim)}`;
          const formaLabel: Record<string, string> = { dinheiro: "Dinheiro", pix: "Pix", transferencia: "Transferência" };
          const mensagem = buildMensagemConfirmacaoRecebimento(
            "💰 *Pagamento registrado!*",
            [
              `Olá ${func.nome},`,
              "um pagamento foi registrado para você:",
              `📅 Período: ${periodo}`,
              `💵 Valor: ${fmtBRL(payload.valor)}`,
              `💳 Forma: ${formaLabel[payload.forma] ?? payload.forma}`,
              `📆 Data: ${fmtDate(payload.data_pagamento)}`,
            ]
          );
          try {
            await serverQuery({
              sql: "INSERT INTO bot_mensagens_pendentes (id, tenant_id, pagamento_id, funcionario_id, mensagem) VALUES (?, ?, ?, ?, ?)",
              values: [crypto.randomUUID(), tenantId, newId, payload.funcionario_id, mensagem],
            });
          } catch { /* notificação não crítica */ }
        }
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(editId ? t("Pagamento atualizado") : t("Pagamento registrado"));
    setPayOpen(false); setEditId(null);
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
    qc.invalidateQueries({ queryKey: ["folha"] });
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
    qc.invalidateQueries({ queryKey: ["folha"] });
  };

  const openVale = (l: any) => {
    const py = parseInt(l.period.slice(0, 4));
    const pm = parseInt(l.period.slice(4, 6)) - 1;
    const pInicio = formatLocalDate(new Date(py, pm, 1));
    const pFim = formatLocalDate(new Date(py, pm + 1, 0));
    setValeForm({
      funcionario_id: l.funcionario.id,
      valor: 0,
      data_pagamento: formatLocalDate(today),
      periodo_inicio: pInicio,
      periodo_fim: pFim,
    });
    setValeOpen(true);
  };

  const saveVale = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    if (!valeForm.funcionario_id) return toast.error(t("Selecione um funcionário."));
    if (!valeForm.periodo_inicio || !valeForm.periodo_fim) return toast.error(t("Período do vale é obrigatório."));
    const valorVale = Number(valeForm.valor ?? 0);
    if (!Number.isFinite(valorVale)) return toast.error(t("Informe um valor de vale válido."));
    if (valorVale < 0) return toast.error(t("Vale não pode ter valor negativo."));

    try {
      const newId = crypto.randomUUID();
      await serverQuery({
        sql: `INSERT INTO pagamentos (id, tenant_id, funcionario_id, periodo_inicio, periodo_fim, valor, status, data_pagamento, forma, observacoes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        values: [
          newId,
          tenantId,
          valeForm.funcionario_id,
          valeForm.periodo_inicio,
          valeForm.periodo_fim,
          toNonNegativeMoney(valeForm.valor),
          "pago",
          valeForm.data_pagamento,
          "dinheiro",
          "[VALE] Adiantamento",
        ],
      });
      // Enfileirar notificação WhatsApp para o funcionário
      const func = funcs.find((f: any) => f.id === valeForm.funcionario_id);
      if (func?.telefone) {
        const mensagem = buildMensagemConfirmacaoRecebimento(
          "💵 *Vale registrado!*",
          [
            `Olá ${func.nome},`,
            "um adiantamento foi registrado para você:",
            `💵 Valor: ${fmtBRL(toNonNegativeMoney(valeForm.valor))}`,
            `📆 Data: ${fmtDate(valeForm.data_pagamento)}`,
          ]
        );
        try {
          await serverQuery({
            sql: "INSERT INTO bot_mensagens_pendentes (id, tenant_id, pagamento_id, funcionario_id, mensagem) VALUES (?, ?, ?, ?, ?)",
            values: [crypto.randomUUID(), tenantId, newId, valeForm.funcionario_id, mensagem],
          });
        } catch { /* notificação não crítica */ }
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }

    toast.success(t("Vale registrado"));
    setValeOpen(false);
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
    qc.invalidateQueries({ queryKey: ["folha"] });
  };

  const reenviarNotificacao = async (p: any) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    if (!p?.id || !p?.funcionario_id) return toast.error(t("Pagamento inválido para reenviar."));

    const detalhes = isValePagamento(p)
      ? [
          `💵 Valor: ${fmtBRL(toNonNegativeMoney(p.valor))}`,
          `📆 Data: ${fmtDate(p.data_pagamento)}`,
        ]
      : [
          `📅 Período: ${fmtDate(p.periodo_inicio)} → ${fmtDate(p.periodo_fim)}`,
          `💵 Valor: ${fmtBRL(toNonNegativeMoney(p.valor))}`,
          `💳 Forma: ${String(p.forma ?? "").toLowerCase() === "dinheiro" ? "Dinheiro" : String(p.forma ?? "")}`,
          `📆 Data: ${fmtDate(p.data_pagamento)}`,
        ];

    const mensagem = buildMensagemConfirmacaoRecebimento(
      isValePagamento(p) ? "💵 *Vale registrado!*" : "💰 *Pagamento registrado!*",
      [
        `Olá ${p.funcionario_nome ?? ""},`,
        ...(isValePagamento(p)
          ? ["um adiantamento foi registrado para você:"]
          : ["um pagamento foi registrado para você:"]),
        ...detalhes,
      ]
    );

    try {
      await serverQuery({
        sql: "INSERT INTO bot_mensagens_pendentes (id, tenant_id, pagamento_id, funcionario_id, mensagem) VALUES (?, ?, ?, ?, ?)",
        values: [crypto.randomUUID(), tenantId, p.id, p.funcionario_id, mensagem],
      });
      await serverQuery({
        sql: "UPDATE pagamentos SET flg_envio_funcionario = 0, flg_vld_funcionario = 0 WHERE id = ? AND tenant_id = ?",
        values: [p.id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }

    toast.success(t("Notificação reenviada"));
    qc.invalidateQueries({ queryKey: ["pagamentos"] });
    qc.invalidateQueries({ queryKey: ["folha"] });
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
              <Users className="h-4 w-4" />
              {t("Funcionários")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalizadores.funcionariosDiferentes}</div>
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
              {folhaError && (
                <div className="mb-2 rounded border border-red-400 bg-red-50 p-2 text-sm text-red-700">
                  Erro ao carregar folha: {String((folhaError as any)?.message ?? folhaError)}
                </div>
              )}
              <Table>
                <TableHeader><TableRow><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("period")}>{t("Período")} {folhaSortIndicator("period")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("funcionario_nome")}>{t("Funcionário")} {folhaSortIndicator("funcionario_nome")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("totalH")}>{t("Horas")} {folhaSortIndicator("totalH")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("totalBruto")}>{t("Valor Total")} {folhaSortIndicator("totalBruto")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("totalVale")}>{t("Valor Vales")}{folhaSortIndicator("totalVale")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleFolhaSort("saldo")}>{t("Saldo")} {folhaSortIndicator("saldo")}</Button></TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {linhasOrdenadas.map((l) => (
                    <TableRow key={`${l.funcionario.id}-${l.period}`}>
                      <TableCell className="text-sm text-muted-foreground">{periodoLabel(l.period)}</TableCell>
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
                  {linhasOrdenadas.length===0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("Sem horas no período.")}</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("data_pagamento")}>{t("Data pgto")} {histSortIndicator("data_pagamento")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("funcionario_nome")}>{t("Funcionário")} {histSortIndicator("funcionario_nome")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("periodo_inicio")}>{t("Período")} {histSortIndicator("periodo_inicio")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("valor")}>{t("Valor")} {histSortIndicator("valor")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("tipo")}>{t("Tipo")} {histSortIndicator("tipo")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("forma")}>{t("Forma")} {histSortIndicator("forma")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleHistSort("status")}>{t("Status")} {histSortIndicator("status")}</Button></TableHead><TableHead><Button variant="ghost" size="sm" className="h-auto p-0 pointer-events-none hover:bg-transparent">{t("Notificação")}</Button></TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {pagamentosOrdenados.map((p:any)=>(
                    <TableRow key={p.id}>
                      <TableCell>{fmtDate(p.data_pagamento)}</TableCell>
                      <TableCell>{p.funcionario_nome}</TableCell>
                      <TableCell>{periodoLabel(periodoFromDate(p.periodo_inicio))}</TableCell>
                      <TableCell>{fmtBRL(toNonNegativeMoney(p.valor))}</TableCell>
                      <TableCell className="capitalize">{tEnum(getTipoPagamento(p))}</TableCell>
                      <TableCell className="capitalize">{tEnum(p.forma)}</TableCell>
                      <TableCell><Badge className={p.status==="pago"?"bg-success/20 text-success":"bg-warning/20"}>{tEnum(p.status)}</Badge></TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <div className="flex items-center gap-1">
                            {Number(p.flg_vld_funcionario) === 1 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <CheckCheck className="h-4 w-4 text-green-600" />
                                </TooltipTrigger>
                                <TooltipContent>Confirmado pelo funcionário</TooltipContent>
                              </Tooltip>
                            ) : Number(p.flg_vld_funcionario) === 2 ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <XCircle className="h-4 w-4 text-red-600" />
                                </TooltipTrigger>
                                <TooltipContent>Desaprovado pelo funcionário</TooltipContent>
                              </Tooltip>
                            ) : p.flg_envio_funcionario ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MessageSquare className="h-4 w-4 text-blue-500" />
                                </TooltipTrigger>
                                <TooltipContent>Notificação enviada — aguardando confirmação</TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <MessageSquare className="h-4 w-4 text-muted-foreground/40" />
                                </TooltipTrigger>
                                <TooltipContent>Notificação não enviada</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                        {Number(p.flg_vld_funcionario) === 2 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="sm" variant="ghost" onClick={()=>reenviarNotificacao(p)} aria-label={t("Reenviar notificação")}>
                                  <RotateCcw className="h-4 w-4 text-red-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("Reenviar para o funcionário")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
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
