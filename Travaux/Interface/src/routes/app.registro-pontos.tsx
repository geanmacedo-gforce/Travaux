import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { serverQuery } from "@/lib/server-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PageHeader, FormDialog, ConfirmDelete } from "@/components/crud";
import { fmtHours } from "@/lib/format";
import { toast } from "sonner";
import { Pencil, Trash2, Clock, Calendar, Users, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/registro-pontos")({ component: Page });

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalDateTime(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function normalizeDateTimeInput(value: any) {
  if (!value) return "";
  const raw = String(value).trim();
  const normalized = raw.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) {
    return normalized.slice(0, 16);
  }
  const dt = new Date(raw);
  if (!Number.isNaN(dt.getTime())) return formatLocalDateTime(dt);
  return "";
}

function formatDistanceMeters(meters: any) {
  const value = Number(meters ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0 m";
  if (value >= 1000) {
    return `${(value / 1000).toFixed(2).replace(".", ",")} km`;
  }
  return `${Math.round(value)} m`;
}

function Page() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const today = new Date();
  const dataInicio = new Date(today.getFullYear(), today.getMonth(), 1);
  
  const [dataInicioFiltro, setDataInicioFiltro] = useState(formatLocalDate(dataInicio));
  const [dataFimFiltro, setDataFimFiltro] = useState(formatLocalDate(today));
  const [funcFilters, setFuncFilters] = useState<Set<string>>(new Set());
  const [obraFilters, setObraFilters] = useState<Set<string>>(new Set());
  const [funcFilterOpen, setFuncFilterOpen] = useState(false);
  const [obraFilterOpen, setObraFilterOpen] = useState(false);
  const [sortField, setSortField] = useState<string>("entrada");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [pontoOpen, setPontoOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [pontoForm, setPontoForm] = useState<any>({
    funcionario_id: "",
    obra_id: "",
    entrada: "",
    saida: "",
    almoco_minutos: "30",
  });
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
    queryKey: ["funcs-ponto", tenantId],
    queryFn: async () =>
      (await serverQuery({
        sql: "SELECT * FROM funcionarios WHERE tenant_id = ? AND status = ? ORDER BY nome",
        values: [tenantId, "ativo"],
      })) ?? [],
    enabled: Boolean(tenantId),
  });

  const { data: obras = [] } = useQuery({
    queryKey: ["obras-ponto", tenantId],
    queryFn: async () =>
      (await serverQuery({
        sql: "SELECT * FROM obras WHERE tenant_id = ? ORDER BY nome",
        values: [tenantId],
      })) ?? [],
    enabled: Boolean(tenantId),
  });

  const { data: pontos = [] } = useQuery({
    queryKey: ["registros-pontos", dataInicioFiltro, dataFimFiltro, tenantId],
    queryFn: async () =>
      (await serverQuery({
        sql: `SELECT h.*, f.nome AS funcionario_nome, o.nome AS obra_nome,
                     d.distancia_metros,
                     d.raio_metros,
                     d.desvio_metros,
                     CASE
                       WHEN h.bot_sessao_id IS NULL THEN 'sem_validacao'
                       WHEN d.id IS NULL THEN 'dentro_raio'
                       ELSE 'fora_raio'
                     END AS status_raio
              FROM horas_trabalhadas h
              LEFT JOIN funcionarios f ON f.id = h.funcionario_id AND f.tenant_id = h.tenant_id
              LEFT JOIN obras o ON o.id = h.obra_id AND o.tenant_id = h.tenant_id
              LEFT JOIN (
                SELECT d1.*
                FROM bot_checkin_divergencias d1
                INNER JOIN (
                  SELECT tenant_id, sessao_id, MAX(created_at) AS max_created_at
                  FROM bot_checkin_divergencias
                  GROUP BY tenant_id, sessao_id
                ) d2
                  ON d1.tenant_id = d2.tenant_id
                 AND d1.sessao_id = d2.sessao_id
                 AND d1.created_at = d2.max_created_at
              ) d ON d.tenant_id = h.tenant_id AND d.sessao_id = h.bot_sessao_id
              WHERE h.tenant_id = ? AND DATE(h.entrada) >= ? AND DATE(h.entrada) <= ?
              ORDER BY h.entrada DESC`,
        values: [tenantId, dataInicioFiltro, dataFimFiltro],
      })) ?? [],
    enabled: Boolean(tenantId),
  });

  // Aplicar filtros
  const pontosFiltrados = useMemo(() => {
    return pontos.filter((p: any) => {
      const passaFuncFilter = funcFilters.size === 0 || funcFilters.has(p.funcionario_id);
      const passaObraFilter = obraFilters.size === 0 || obraFilters.has(p.obra_id);
      return passaFuncFilter && passaObraFilter;
    });
  }, [pontos, funcFilters, obraFilters]);

  const pontosOrdenados = useMemo(() => {
    const sorted = [...pontosFiltrados];
    sorted.sort((a: any, b: any) => {
      let av: any = a[sortField];
      let bv: any = b[sortField];

      if (sortField === "entrada" || sortField === "saida") {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else if (sortField === "almoco_minutos" || sortField === "horas") {
        av = Number(av ?? 0);
        bv = Number(bv ?? 0);
      } else {
        av = String(av ?? "").toLowerCase();
        bv = String(bv ?? "").toLowerCase();
      }

      if (av < bv) return sortDirection === "asc" ? -1 : 1;
      if (av > bv) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [pontosFiltrados, sortField, sortDirection]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  };

  const sortIndicator = (field: string) => {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  };

  // Calcular totalizadores
  const totalizadores = useMemo(() => {
    const totalHoras = pontosFiltrados.reduce((sum: number, p: any) => sum + Number(p.horas || 0), 0);
    const diasUnicos = new Set(
      pontosFiltrados.map((p: any) => {
        if (p.entrada) {
          return formatLocalDate(new Date(p.entrada));
        }
        return "";
      })
    ).size;
    const obrasUnicas = new Set(pontosFiltrados.map((p: any) => p.obra_id)).size;
    return { totalHoras, diasUnicos, obrasUnicas };
  }, [pontosFiltrados]);

  const calcularHoras = (entrada: string, saida: string, almocoMinutos: string | number = 0) => {
    if (!entrada || !saida) return "0.00";
    try {
      const entradaDate = new Date(entrada);
      const saidaDate = new Date(saida);
      const intervaloMs = saidaDate.getTime() - entradaDate.getTime();
      const almocoMs = Number(almocoMinutos || 0) * 60 * 1000;
      const horasLiquidas = Math.max(intervaloMs - almocoMs, 0);
      const horas = (horasLiquidas / (1000 * 60 * 60)).toFixed(2);
      return horas;
    } catch {
      return "0.00";
    }
  };

  const toggleFuncFilter = (funcId: string) => {
    const newFilters = new Set(funcFilters);
    if (newFilters.has(funcId)) {
      newFilters.delete(funcId);
    } else {
      newFilters.add(funcId);
    }
    setFuncFilters(newFilters);
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
    const newFilters = new Set(obraFilters);
    if (newFilters.has(obraId)) {
      newFilters.delete(obraId);
    } else {
      newFilters.add(obraId);
    }
    setObraFilters(newFilters);
  };

  const toggleAllObraFilters = () => {
    const allSelected = obras.length > 0 && obraFilters.size === obras.length;
    if (allSelected) {
      setObraFilters(new Set());
      return;
    }
    setObraFilters(new Set(obras.map((o: any) => o.id)));
  };

  const openNew = () => {
    setEditId(null);
    const dataBase = new Date();
    const entradaPadrao = new Date(dataBase);
    entradaPadrao.setHours(7, 0, 0, 0);
    const saidaPadrao = new Date(dataBase);
    saidaPadrao.setHours(17, 30, 0, 0);
    setPontoForm({
      funcionario_id: "",
      obra_id: "",
      entrada: formatLocalDateTime(entradaPadrao),
      saida: formatLocalDateTime(saidaPadrao),
      almoco_minutos: "30",
    });
    setPontoOpen(true);
  };

  const openEdit = (p: any) => {
    setEditId(p.id);
    setPontoForm({
      funcionario_id: p.funcionario_id,
      obra_id: p.obra_id,
      entrada: normalizeDateTimeInput(p.entrada),
      saida: normalizeDateTimeInput(p.saida),
      almoco_minutos: String(p.almoco_minutos ?? 60),
    });
    setPontoOpen(true);
  };

  const savePonto = async () => {
    if (!tenantId) return toast.error(isEnglishFallback(t, "Tenant não identificado na sessão."));
    if (!pontoForm.funcionario_id || !pontoForm.obra_id) {
      return toast.error(isEnglishFallback(t, "Funcionário e obra são obrigatórios"));
    }
    if (!pontoForm.entrada || !pontoForm.saida) {
      return toast.error(isEnglishFallback(t, "Entrada e saída são obrigatórias"));
    }

    const entradaDate = new Date(pontoForm.entrada);
    const saidaDate = new Date(pontoForm.saida);
    const now = new Date();

    if (Number.isNaN(entradaDate.getTime()) || Number.isNaN(saidaDate.getTime())) {
      return toast.error(isEnglishFallback(t, "Data/hora inválida"));
    }
    if (entradaDate > now || saidaDate > now) {
      return toast.error(isEnglishFallback(t, "Não é permitido cadastrar data/hora futura"));
    }
    if (saidaDate <= entradaDate) {
      return toast.error(isEnglishFallback(t, "A saída deve ser maior que a entrada"));
    }

    const horas = calcularHoras(pontoForm.entrada, pontoForm.saida, pontoForm.almoco_minutos);

    try {
      const diaRegistro = formatLocalDate(entradaDate);
      const conflitosMesmoDia: any[] =
        (await serverQuery({
          sql: `SELECT id, obra_id, entrada, saida
                FROM horas_trabalhadas
                WHERE tenant_id = ?
                  AND funcionario_id = ?
                  AND DATE(entrada) = ?
                  ${editId ? "AND id <> ?" : ""}`,
          values: editId
            ? [tenantId, pontoForm.funcionario_id, diaRegistro, editId]
            : [tenantId, pontoForm.funcionario_id, diaRegistro],
        })) ?? [];

      const temConflitoHorario = conflitosMesmoDia.some((registro: any) => {
        const inicioExistente = new Date(registro.entrada);
        const fimExistente = new Date(registro.saida);
        if (Number.isNaN(inicioExistente.getTime()) || Number.isNaN(fimExistente.getTime())) {
          return false;
        }
        return entradaDate < fimExistente && saidaDate > inicioExistente;
      });

      if (temConflitoHorario) {
        return toast.error(t("Existe conflito de horário com registro já cadastrado"));
      }

      const temMesmaObraNoDia = conflitosMesmoDia.some((registro: any) => registro.obra_id === pontoForm.obra_id);
      if (temMesmaObraNoDia) {
        return toast.error(t("Já existem horas dessa pessoa nessa obra neste dia. Edite o registro existente"));
      }

      if (editId) {
        await serverQuery({
          sql: `UPDATE horas_trabalhadas
                SET funcionario_id = ?, obra_id = ?, entrada = ?, saida = ?, almoco_minutos = ?, horas = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            pontoForm.funcionario_id,
            pontoForm.obra_id,
            pontoForm.entrada,
            pontoForm.saida,
            Number(pontoForm.almoco_minutos),
            horas,
            editId,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO horas_trabalhadas (id, tenant_id, funcionario_id, obra_id, entrada, saida, almoco_minutos, horas)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            pontoForm.funcionario_id,
            pontoForm.obra_id,
            pontoForm.entrada,
            pontoForm.saida,
            Number(pontoForm.almoco_minutos),
            horas,
          ],
        });
      }
      toast.success(t("Registro salvo!"));
      setPontoOpen(false);
      qc.invalidateQueries({ queryKey: ["registros-pontos"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const deletePonto = async (id: string) => {
    if (!tenantId) return toast.error(isEnglishFallback(t, "Tenant não identificado na sessão."));
    try {
      await serverQuery({
        sql: "DELETE FROM horas_trabalhadas WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
      toast.success(t("Registro deletado!"));
      qc.invalidateQueries({ queryKey: ["registros-pontos"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Registro de Pontos" description="Controle de entrada e saída dos funcionários" />

      {/* Cards Totalizadores */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Total de Horas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmtHours(totalizadores.totalHoras)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {t("Dias com Checkin")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalizadores.diasUnicos}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {t("Obras Diferentes")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalizadores.obrasUnicas}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle>{t("Registros")}</CardTitle>
            <Button onClick={openNew} size="sm">
              {t("Novo Registro")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtros */}
          <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label>{t("Data Início")}</Label>
              <Input
                type="date"
                value={dataInicioFiltro}
                onChange={(e) => setDataInicioFiltro(e.target.value)}
              />
            </div>
            <div>
              <Label>{t("Data Fim")}</Label>
              <Input
                type="date"
                value={dataFimFiltro}
                onChange={(e) => setDataFimFiltro(e.target.value)}
              />
            </div>
            <div ref={funcFilterRef} className="relative self-end">
              <Collapsible open={funcFilterOpen} onOpenChange={setFuncFilterOpen}>
                <CollapsibleTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <span>{t("Funcionário(s)")} {funcFilters.size > 0 && `(${funcFilters.size})`}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${funcFilterOpen ? 'rotate-0' : '-rotate-90'}`} />
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
                          <Checkbox
                            checked={funcFilters.has(f.id)}
                            onCheckedChange={() => toggleFuncFilter(f.id)}
                          />
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
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                  >
                    <span>{t("Obra(s)")} {obraFilters.size > 0 && `(${obraFilters.size})`}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${obraFilterOpen ? 'rotate-0' : '-rotate-90'}`} />
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
                          <Checkbox
                            checked={obraFilters.has(o.id)}
                            onCheckedChange={() => toggleObraFilter(o.id)}
                          />
                          <button type="button" className="text-sm text-left cursor-pointer flex-1" onClick={() => toggleObraFilter(o.id)}>{o.nome}</button>
                        </div>
                      ))}
                    </>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort("entrada")}>{t("Entrada")} {sortIndicator("entrada")}</Button></TableHead>
                  <TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort("saida")}>{t("Saída")} {sortIndicator("saida")}</Button></TableHead>
                  <TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort("almoco_minutos")}>{t("Almoço")} {sortIndicator("almoco_minutos")}</Button></TableHead>
                  <TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort("horas")}>{t("Horas")} {sortIndicator("horas")}</Button></TableHead>
                  <TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort("funcionario_nome")}>{t("Funcionário")} {sortIndicator("funcionario_nome")}</Button></TableHead>
                  <TableHead><Button variant="ghost" size="sm" className="h-auto p-0" onClick={() => handleSort("obra_nome")}>{t("Obra")} {sortIndicator("obra_nome")}</Button></TableHead>
                  <TableHead>{t("Raio da Obra")}</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pontosOrdenados.map((p: any) => {
                  const entrada = p.entrada ? new Date(p.entrada) : null;
                  const saida = p.saida ? new Date(p.saida) : null;
                  const statusRaio = String(p.status_raio || "sem_validacao");
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">
                        {entrada ? entrada.toLocaleString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {saida ? saida.toLocaleString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell>{p.almoco_minutos ?? 60} min</TableCell>
                      <TableCell>
                        <Badge variant="outline">{fmtHours(p.horas)}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{p.funcionario_nome}</TableCell>
                      <TableCell>{p.obra_nome}</TableCell>
                      <TableCell>
                        {statusRaio === "fora_raio" ? (
                          <div className="space-y-1">
                            <Badge className="bg-red-100 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-300 dark:border-red-900/40">{t("Fora do raio")}</Badge>
                            <div className="text-xs text-muted-foreground">
                              {t("Distância")}: {formatDistanceMeters(p.distancia_metros)}
                            </div>
                          </div>
                        ) : statusRaio === "dentro_raio" ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{t("No raio")}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">{t("Sem validação")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEdit(p)}
                                  aria-label={t("Editar registro")}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>{t("Editar registro")}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <ConfirmDelete onConfirm={() => deletePonto(p.id)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pontosOrdenados.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground">
                      {t("Nenhum registro encontrado")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <FormDialog
        open={pontoOpen}
        onOpenChange={setPontoOpen}
        title={editId ? "Editar Registro de Ponto" : "Novo Registro de Ponto"}
        onSubmit={savePonto}
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="func">{t("Funcionário")}</Label>
            <Select
              value={pontoForm.funcionario_id}
              onValueChange={(v) =>
                setPontoForm({ ...pontoForm, funcionario_id: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Selecione um funcionário")} />
              </SelectTrigger>
              <SelectContent>
                {funcs.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="obra">{t("Obra")}</Label>
            <Select
              value={pontoForm.obra_id}
              onValueChange={(v) =>
                setPontoForm({ ...pontoForm, obra_id: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Selecione uma obra")} />
              </SelectTrigger>
              <SelectContent>
                {obras.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="entrada">{t("Hora de Entrada")}</Label>
            <Input
              type="datetime-local"
              value={pontoForm.entrada}
              onChange={(e) =>
                setPontoForm({ ...pontoForm, entrada: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="saida">{t("Hora de Saída")}</Label>
            <Input
              type="datetime-local"
              value={pontoForm.saida}
              onChange={(e) =>
                setPontoForm({ ...pontoForm, saida: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="almoco">{t("Tempo de Almoço")}</Label>
            <Select
              value={String(pontoForm.almoco_minutos)}
              onValueChange={(v) =>
                setPontoForm({ ...pontoForm, almoco_minutos: v })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("Selecione o intervalo")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">{t("30 minutos")}</SelectItem>
                <SelectItem value="45">{t("45 minutos")}</SelectItem>
                <SelectItem value="60">{t("60 minutos")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="p-3 bg-muted rounded text-sm">
            <strong>{t("Total de horas:")}</strong> {fmtHours(calcularHoras(pontoForm.entrada, pontoForm.saida, pontoForm.almoco_minutos))}
          </div>
        </div>
      </FormDialog>
    </div>
  );
}

function isEnglishFallback(t: (value: string) => string, value: string) {
  const translated = t(value);
  return translated === value
    ? ({
        "Tenant não identificado na sessão.": "Tenant not identified in session.",
        "Funcionário e obra são obrigatórios": "Employee and project are required",
        "Entrada e saída são obrigatórias": "Entry and exit are required",
        "Data/hora inválida": "Invalid date/time",
        "Não é permitido cadastrar data/hora futura": "Future date/time is not allowed",
        "A saída deve ser maior que a entrada": "Exit time must be greater than entry time",
      }[value] ?? value)
    : translated;
}
