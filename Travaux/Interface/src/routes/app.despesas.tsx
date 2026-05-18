import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { serverQuery } from "@/lib/server-api";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/CurrencyInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageHeader, FormDialog, ConfirmDelete, NewButton } from "@/components/crud";
import { ComprovanteThumb } from "@/components/ComprovantePreview";
import { fmtBRL, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { Upload, Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/despesas")({ component: Page });

const empty = { obra_id:"", categoria:"combustivel", produto_id:"", produto_quantidade:"1", produto_unidade:"", data: new Date().toISOString().slice(0,10), data_checkout:"", descricao:"", litros:"", qtd_pessoas:"", local:"", valor:0, responsavel_id:"" };

function formatLocalDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateInput(value: any) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler o arquivo anexado."));
    reader.readAsDataURL(file);
  });
}

async function ensureComprovanteColumnCapacity() {
  try {
    await serverQuery({ sql: "ALTER TABLE despesas MODIFY comprovante_url LONGTEXT NULL" });
  } catch {
    // If migration privileges are limited or column is already LONGTEXT, keep going.
  }
}

async function ensureDespesasProductSupport() {
  try {
    await serverQuery({ sql: "ALTER TABLE despesas ADD COLUMN produto_id CHAR(36) NULL AFTER obra_id" });
  } catch {
    // Column already exists or permissions are limited.
  }

  try {
    await serverQuery({ sql: "ALTER TABLE despesas ADD COLUMN produto_quantidade DECIMAL(12,2) NULL AFTER produto_id" });
  } catch {
    // Column already exists or permissions are limited.
  }

  try {
    await serverQuery({ sql: "ALTER TABLE despesas ADD COLUMN produto_unidade VARCHAR(30) NULL AFTER produto_quantidade" });
  } catch {
    // Column already exists or permissions are limited.
  }

  try {
    await serverQuery({
      sql: "ALTER TABLE despesas MODIFY categoria ENUM('combustivel','alimentacao','hospedagem','outros','produtos_insumos','nota_fiscal') NOT NULL",
    });
  } catch {
    // Enum may already be updated or migration privileges may be limited.
  }
}

function Page() {
  const { user } = useAuth();
  const { t, tEnum } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const today = new Date();
  const [filterCat, setFilterCat] = useState("all");
  const [dataInicio, setDataInicio] = useState(formatLocalDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [dataFim, setDataFim] = useState(formatLocalDate(today));
  const [filterObra, setFilterObra] = useState("all");
  const [filterResp, setFilterResp] = useState("all");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);
  const [file, setFile] = useState<File | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["despesas-all", tenantId, filterCat, dataInicio, dataFim, filterObra, filterResp],
    queryFn: async () => {
      const where = ["d.tenant_id = ?", "d.data >= ?", "d.data <= ?"];
      const values: any[] = [tenantId, dataInicio, dataFim];

      if (filterCat !== "all") {
        where.push("d.categoria = ?");
        values.push(filterCat);
      }
      if (filterObra !== "all") {
        where.push("d.obra_id = ?");
        values.push(filterObra);
      }
      if (filterResp !== "all") {
        where.push("d.responsavel_id = ?");
        values.push(filterResp);
      }

      return (await serverQuery({
        sql: `SELECT d.*, o.nome AS obra_nome, f.nome AS responsavel_nome
              FROM despesas d
              LEFT JOIN obras o ON o.id = d.obra_id AND o.tenant_id = d.tenant_id
              LEFT JOIN funcionarios f ON f.id = d.responsavel_id AND f.tenant_id = d.tenant_id
              WHERE ${where.join(" AND ")}
              ORDER BY d.data DESC`,
        values,
      })) ?? [];
    },
    enabled: Boolean(tenantId),
  });
  const { data: obras = [] } = useQuery({
    queryKey: ["obras-list", tenantId],
    queryFn: async () => (await serverQuery({ sql: "SELECT id, nome FROM obras WHERE tenant_id = ? ORDER BY nome", values: [tenantId] })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: funcs = [] } = useQuery({
    queryKey: ["funcs-list-all", tenantId],
    queryFn: async () => (await serverQuery({ sql: "SELECT id, nome FROM funcionarios WHERE tenant_id = ? ORDER BY nome", values: [tenantId] })) ?? [],
    enabled: Boolean(tenantId),
  });
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-list-all", tenantId],
    queryFn: async () => (await serverQuery({ sql: "SELECT id, nome, unidade, valor_unitario FROM produtos WHERE tenant_id = ? ORDER BY nome", values: [tenantId] })) ?? [],
    enabled: Boolean(tenantId),
  });
  const produtoSelecionado = produtos.find((item:any) => item.id === form.produto_id);
  const produtoQuantidade = Number(form.produto_quantidade || 0);
  const produtoValorUnitario = Number(produtoSelecionado?.valor_unitario ?? 0);
  const produtoValorTotal = produtoValorUnitario * produtoQuantidade;

  const openNew = () => { setEdit(null); setForm({...empty}); setFile(null); setOpen(true); };
  const openEdit = (r: any) => {
    setEdit(r);
    setForm({
      ...empty, ...r,
      produto_id: r.produto_id ?? "",
      produto_quantidade: r.produto_quantidade != null ? String(r.produto_quantidade) : "1",
      produto_unidade: r.produto_unidade ?? "",
      data: normalizeDateInput(r.data),
      data_checkout: normalizeDateInput(r.data_checkout),
      descricao: r.descricao ?? "",
      litros: r.litros ?? "",
      qtd_pessoas: r.qtd_pessoas ?? "",
      local: r.local ?? "",
      responsavel_id: r.responsavel_id ?? "",
    });
    setFile(null);
    setOpen(true);
  };

  const save = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    let comprovante_url: string | null | undefined = undefined;
    if (file) {
      try {
        await ensureComprovanteColumnCapacity();
        comprovante_url = await fileToDataUrl(file);
      } catch (error) {
        return toast.error((error as Error).message);
      }
    }
    const payload: any = {
      obra_id: form.obra_id,
      categoria: form.categoria,
      produto_id: form.categoria === "produtos_insumos" ? form.produto_id || null : null,
      produto_quantidade: form.categoria === "produtos_insumos" ? Number(form.produto_quantidade || 0) : null,
      produto_unidade: form.categoria === "produtos_insumos" ? form.produto_unidade || null : null,
      data: form.data,
      descricao: form.descricao,
      valor: Number(form.valor), responsavel_id: form.responsavel_id || null,
      litros: form.litros ? Number(form.litros) : null,
      qtd_pessoas: form.qtd_pessoas ? Number(form.qtd_pessoas) : null,
      local: form.local || null, data_checkout: form.data_checkout || null,
    };
    if (comprovante_url !== undefined) payload.comprovante_url = comprovante_url;
    if (!payload.obra_id) return toast.error(t("Selecione a obra"));
    if (payload.categoria === "produtos_insumos" && !payload.produto_id) return toast.error(t("Selecione o produto ou insumo"));
    if (payload.categoria === "produtos_insumos" || payload.categoria === "nota_fiscal") {
      await ensureDespesasProductSupport();
    }
    if (payload.categoria === "produtos_insumos") {
      const produtoSelecionado = produtos.find((item:any) => item.id === payload.produto_id);
      if (!payload.produto_quantidade || payload.produto_quantidade <= 0) return toast.error(t("Informe a quantidade"));
      payload.produto_unidade = produtoSelecionado?.unidade || payload.produto_unidade;
      payload.valor = Number(produtoSelecionado?.valor_unitario ?? 0) * Number(payload.produto_quantidade);
      if (!payload.descricao && produtoSelecionado?.nome) {
        payload.descricao = produtoSelecionado.nome;
      }
    }
    if (payload.categoria === "nota_fiscal" && !file && !edit?.comprovante_url) {
      return toast.error(t("Anexe a foto da nota fiscal."));
    }
    try {
      if (edit) {
        await serverQuery({
          sql: `UPDATE despesas
                SET obra_id = ?, categoria = ?, produto_id = ?, produto_quantidade = ?, produto_unidade = ?, data = ?, data_checkout = ?, descricao = ?, litros = ?, qtd_pessoas = ?, local = ?, valor = ?, responsavel_id = ?, comprovante_url = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            payload.obra_id,
            payload.categoria,
            payload.produto_id,
            payload.produto_quantidade,
            payload.produto_unidade,
            payload.data,
            payload.data_checkout,
            payload.descricao || null,
            payload.litros,
            payload.qtd_pessoas,
            payload.local,
            payload.valor,
            payload.responsavel_id,
            payload.comprovante_url || edit.comprovante_url || null,
            edit.id,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO despesas (id, tenant_id, obra_id, categoria, produto_id, produto_quantidade, produto_unidade, data, data_checkout, descricao, litros, qtd_pessoas, local, valor, responsavel_id, comprovante_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            payload.obra_id,
            payload.categoria,
            payload.produto_id,
            payload.produto_quantidade,
            payload.produto_unidade,
            payload.data,
            payload.data_checkout,
            payload.descricao || null,
            payload.litros,
            payload.qtd_pessoas,
            payload.local,
            payload.valor,
            payload.responsavel_id,
            payload.comprovante_url || null,
          ],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(edit ? t("Despesa atualizada") : t("Despesa registrada")); setOpen(false); qc.invalidateQueries({ queryKey: ["despesas-all"] });
  };

  const del = async (id: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "DELETE FROM despesas WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    qc.invalidateQueries({ queryKey: ["despesas-all"] });
  };

  const limparFiltros = () => {
    const now = new Date();
    setDataInicio(formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    setDataFim(formatLocalDate(now));
    setFilterObra("all");
    setFilterResp("all");
    setFilterCat("all");
  };


  return (
    <div>
      <PageHeader title="Despesas Operacionais" action={<NewButton onClick={openNew}/>} />
      <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <Label>{t("Data início")}</Label>
          <Input type="date" value={dataInicio} onChange={(e)=>setDataInicio(e.target.value)} />
        </div>
        <div>
          <Label>{t("Data fim")}</Label>
          <Input type="date" value={dataFim} onChange={(e)=>setDataFim(e.target.value)} />
        </div>
        <div>
          <Label>{t("Obra")}</Label>
          <Select value={filterObra} onValueChange={setFilterObra}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todas obras")}</SelectItem>
              {obras.map((o:any)=><SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("Responsável")}</Label>
          <Select value={filterResp} onValueChange={setFilterResp}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todos responsáveis")}</SelectItem>
              {funcs.map((f:any)=><SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>{t("Categoria")}</Label>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger><SelectValue/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("Todas categorias")}</SelectItem>
              <SelectItem value="combustivel">{t("Combustível")}</SelectItem>
              <SelectItem value="alimentacao">{t("Alimentação")}</SelectItem>
              <SelectItem value="hospedagem">{t("Hospedagem")}</SelectItem>
              <SelectItem value="produtos_insumos">{t("Produtos & Insumos")}</SelectItem>
              <SelectItem value="nota_fiscal">{t("Nota fiscal")}</SelectItem>
              <SelectItem value="outros">{t("Outros")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="button" variant="outline" className="w-full" onClick={limparFiltros}>
            {t("Limpar filtros")}
          </Button>
        </div>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Data")}</TableHead><TableHead>{t("Categoria")}</TableHead><TableHead>{t("Obra")}</TableHead><TableHead>{t("Descrição")}</TableHead><TableHead>{t("Resp.")}</TableHead><TableHead>{t("Valor")}</TableHead><TableHead>{t("Comprovante")}</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((r:any)=>(
              <TableRow key={r.id}>
                <TableCell>{fmtDate(r.data)}</TableCell>
                <TableCell className="capitalize">{r.categoria === "produtos_insumos" ? t("Produtos & Insumos") : r.categoria === "nota_fiscal" ? t("Nota fiscal") : tEnum(r.categoria)}</TableCell>
                <TableCell>{r.obra_nome}</TableCell>
                <TableCell className="text-xs">{r.produto_quantidade ? `${r.descricao}${r.produto_unidade ? ` (${Number(r.produto_quantidade)} ${r.produto_unidade})` : ` (${Number(r.produto_quantidade)})`}` : r.descricao}</TableCell>
                <TableCell>{r.responsavel_nome ?? "-"}</TableCell>
                <TableCell>{fmtBRL(r.valor)}</TableCell>
                <TableCell><ComprovanteThumb path={r.comprovante_url}/></TableCell>
                <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={()=>openEdit(r)} aria-label={t("Editar despesa")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("Editar despesa")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ConfirmDelete onConfirm={()=>del(r.id)}/>
                </TableCell>
              </TableRow>
            ))}
            {rows.length===0 && <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("Nenhuma despesa.")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar despesa" : "Nova despesa"} onSubmit={save}>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Categoria")}</Label>
            <Select value={form.categoria} onValueChange={(v)=>setForm({
              ...form,
              categoria: v,
              produto_id: v === "produtos_insumos" ? form.produto_id : "",
              produto_quantidade: v === "produtos_insumos" ? form.produto_quantidade : "1",
              produto_unidade: v === "produtos_insumos" ? form.produto_unidade : "",
            })}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="combustivel">{t("Combustível")}</SelectItem><SelectItem value="alimentacao">{t("Alimentação")}</SelectItem><SelectItem value="hospedagem">{t("Hospedagem")}</SelectItem><SelectItem value="produtos_insumos">{t("Produtos & Insumos")}</SelectItem><SelectItem value="nota_fiscal">{t("Nota fiscal")}</SelectItem><SelectItem value="outros">{t("Outros")}</SelectItem></SelectContent>
            </Select></div>
          <div><Label>{t("Obra")}</Label>
            <Select value={form.obra_id} onValueChange={(v)=>setForm({...form,obra_id:v})}>
              <SelectTrigger><SelectValue placeholder={t("Selecione")}/></SelectTrigger>
              <SelectContent>{obras.map((o:any)=><SelectItem key={o.id} value={o.id}>{o.nome}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>
        {form.categoria === "produtos_insumos" && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
              <Label>{t("Produto ou insumo")}</Label>
              <Select value={form.produto_id} onValueChange={(v)=>{
                const produtoSelecionado = produtos.find((item:any) => item.id === v);
                const quantidade = Number(form.produto_quantidade || 1);
                setForm({
                  ...form,
                  produto_id: v,
                  produto_unidade: produtoSelecionado?.unidade || "",
                  valor: (Number(produtoSelecionado?.valor_unitario ?? 0) * quantidade),
                  descricao: form.descricao || produtoSelecionado?.nome || "",
                });
              }}>
                <SelectTrigger><SelectValue placeholder={t("Selecione")}/></SelectTrigger>
                <SelectContent>{produtos.map((p:any)=><SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
              </Select>
              </div>
              <div>
              <Label>{`${t("Quantidade")} ${form.produto_unidade ? `(${form.produto_unidade})` : ""}`.trim()}</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={form.produto_quantidade}
                onChange={(e)=>{
                  const nextQuantidade = e.target.value;
                  const produtoSelecionado = produtos.find((item:any) => item.id === form.produto_id);
                  setForm({
                    ...form,
                    produto_quantidade: nextQuantidade,
                    valor: Number(produtoSelecionado?.valor_unitario ?? 0) * Number(nextQuantidade || 0),
                  });
                }}
              />
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              <div>{t("Valor unitário")}: <strong className="text-foreground">{fmtBRL(produtoValorUnitario)}</strong></div>
              <div>{t("Total")}: <strong className="text-foreground">{fmtBRL(produtoValorTotal)}</strong></div>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Data")}</Label><Input type="date" value={form.data} onChange={(e)=>setForm({...form,data:e.target.value})}/></div>
          {form.categoria === "hospedagem" && <div><Label>{t("Check-out")}</Label><Input type="date" value={form.data_checkout} onChange={(e)=>setForm({...form,data_checkout:e.target.value})}/></div>}
        </div>
        {form.categoria === "nota_fiscal" && (
          <p className="text-xs text-muted-foreground">{t("Use a descrição para listar os produtos comprados na nota fiscal e anexe a foto no comprovante.")}</p>
        )}
        <div><Label>{form.categoria === "nota_fiscal" ? t("Descrição da compra da nota fiscal") : t("Descrição")}</Label><Textarea value={form.descricao} onChange={(e)=>setForm({...form,descricao:e.target.value})}/></div>
        {form.categoria === "combustivel" && (<div><Label>{t("Litros (opcional)")}</Label><Input type="number" step="0.01" value={form.litros} onChange={(e)=>setForm({...form,litros:e.target.value})}/></div>)}
        {(form.categoria === "alimentacao" || form.categoria === "hospedagem") && (<div className="grid grid-cols-2 gap-2"><div><Label>{t("Qtd pessoas")}</Label><Input type="number" value={form.qtd_pessoas} onChange={(e)=>setForm({...form,qtd_pessoas:e.target.value})}/></div>{form.categoria==="hospedagem" && <div><Label>{t("Local")}</Label><Input value={form.local} onChange={(e)=>setForm({...form,local:e.target.value})}/></div>}</div>)}
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Valor")}</Label><CurrencyInput required value={form.valor} onValueChange={(value)=>setForm({...form,valor:value})}/></div>
          <div><Label>{t("Responsável")}</Label>
            <Select value={form.responsavel_id} onValueChange={(v)=>setForm({...form,responsavel_id:v})}>
              <SelectTrigger><SelectValue placeholder="-"/></SelectTrigger>
              <SelectContent>{funcs.map((f:any)=><SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}</SelectContent>
            </Select></div>
        </div>
        <div>
          <Label className="flex items-center gap-1"><Upload className="h-3 w-3"/>{form.categoria === "nota_fiscal" ? t("Foto da nota fiscal") : t("Comprovante")}</Label>
          <Input
            type="file"
            accept="image/*,application/pdf"
            capture="environment"
            onChange={(e)=>setFile(e.target.files?.[0] ?? null)}
          />
          <p className="text-xs text-muted-foreground mt-1">{t("No celular, você pode tirar a foto na hora pela câmera.")}</p>
        </div>
      </FormDialog>
    </div>
  );
}
