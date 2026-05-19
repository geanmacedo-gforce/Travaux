import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { PageHeader, SearchBar, FormDialog, ConfirmDelete, NewButton } from "@/components/crud";
import { fmtBRL } from "@/lib/format";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { MultiSelectFilter } from "@/components/MultiSelectFilter";

export const Route = createFileRoute("/app/produtos")({ component: Page });
const empty = { nome:"", categoria:"outros", unidade:"un", valor_unitario:0, fornecedor:"", observacoes:"" };

function normalizeCategorySlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

async function ensureProductCategoriesSupport(tenantId: string) {
  await serverQuery({
    sql: `CREATE TABLE IF NOT EXISTS produto_categorias (
          id CHAR(36) NOT NULL,
          tenant_id CHAR(36) NOT NULL,
          slug VARCHAR(80) NOT NULL,
          nome VARCHAR(80) NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_produto_categorias_tenant_slug (tenant_id, slug),
          KEY idx_produto_categorias_tenant_id (tenant_id),
          CONSTRAINT fk_produto_categorias_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  });

  // Allow custom categories beyond the legacy enum values.
  await serverQuery({
    sql: "ALTER TABLE produtos MODIFY categoria VARCHAR(80) NOT NULL DEFAULT 'outros'",
  });

  const categoriasJaUsadas: any[] = (await serverQuery({
    sql: "SELECT DISTINCT categoria FROM produtos WHERE tenant_id = ? AND categoria IS NOT NULL AND categoria <> ''",
    values: [tenantId],
  })) ?? [];

  for (const registro of categoriasJaUsadas) {
    const slug = normalizeCategorySlug(String(registro.categoria ?? ""));
    if (!slug) continue;
    const nome = String(registro.categoria ?? "").replace(/_/g, " ").trim() || slug;
    await serverQuery({
      sql: `INSERT INTO produto_categorias (id, tenant_id, slug, nome)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE nome = nome`,
      values: [crypto.randomUUID(), tenantId, slug, nome],
    });
  }
}

function Page() {
  const { user } = useAuth();
  const { t } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ nome: "" });
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: categoryRows = [] } = useQuery({
    queryKey: ["produto-categorias", tenantId],
    enabled: Boolean(tenantId),
    queryFn: async () => {
      await ensureProductCategoriesSupport(tenantId);
      return (await serverQuery({
        sql: "SELECT id, slug, nome FROM produto_categorias WHERE tenant_id = ? ORDER BY nome",
        values: [tenantId],
      })) ?? [];
    },
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["produtos", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT * FROM produtos WHERE tenant_id = ? ORDER BY nome",
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const filtered = rows.filter((r: any) =>
    r.nome.toLowerCase().includes(q.toLowerCase()) && (cat.size === 0 || cat.has(r.categoria)));

  const categoryNameBySlug = useMemo(() => {
    return new Map(categoryRows.map((item: any) => [String(item.slug), String(item.nome)]));
  }, [categoryRows]);

  const categoryUsageBySlug = useMemo(() => {
    const usage = new Map<string, number>();
    for (const row of rows as any[]) {
      const slug = String(row.categoria ?? "");
      if (!slug) continue;
      usage.set(slug, (usage.get(slug) ?? 0) + 1);
    }
    return usage;
  }, [rows]);

  const categoryOptions = useMemo(
    () => categoryRows.map((item: any) => ({ value: String(item.slug), label: String(item.nome) })),
    [categoryRows],
  );

  const categoryBySlug = useMemo(() => {
    return new Map(categoryRows.map((item: any) => [String(item.slug), item]));
  }, [categoryRows]);

  const openNew = () => {
    setEdit(null);
    const defaultCategory = categoryRows[0]?.slug ?? "outros";
    setForm({ ...empty, categoria: defaultCategory });
    setOpen(true);
  };
  const openEdit = (r: any) => { setEdit(r); setForm({...r}); setOpen(true); };

  const openNewCategory = () => {
    setEditingCategoryId(null);
    setCategoryForm({ nome: "" });
    setCategoryOpen(true);
  };

  const openEditCategory = (category: any) => {
    setEditingCategoryId(String(category.id));
    setCategoryForm({ nome: String(category.nome ?? "") });
    setCategoryOpen(true);
  };

  const saveCategory = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const nome = categoryForm.nome.trim();
    const slug = normalizeCategorySlug(nome);

    if (!nome) return toast.error(t("Informe o nome da categoria."));
    if (!slug) return toast.error(t("Nome da categoria inválido."));

    try {
      await ensureProductCategoriesSupport(tenantId);

      const slugInUse: any[] = (await serverQuery({
        sql: "SELECT id FROM produto_categorias WHERE tenant_id = ? AND slug = ? LIMIT 1",
        values: [tenantId, slug],
      })) ?? [];

      if (slugInUse.length > 0 && String(slugInUse[0].id) !== String(editingCategoryId ?? "")) {
        return toast.error(t("Já existe uma categoria com esse nome"));
      }

      if (editingCategoryId) {
        const current = categoryRows.find((item: any) => String(item.id) === editingCategoryId);
        if (!current) {
          return toast.error(t("Categoria não encontrada"));
        }

        const oldSlug = String(current.slug);
        await serverQuery({
          sql: "UPDATE produto_categorias SET slug = ?, nome = ? WHERE id = ? AND tenant_id = ?",
          values: [slug, nome, editingCategoryId, tenantId],
        });

        if (oldSlug !== slug) {
          await serverQuery({
            sql: "UPDATE produtos SET categoria = ? WHERE tenant_id = ? AND categoria = ?",
            values: [slug, tenantId, oldSlug],
          });
        }
      } else {
        await serverQuery({
          sql: "INSERT INTO produto_categorias (id, tenant_id, slug, nome) VALUES (?, ?, ?, ?)",
          values: [crypto.randomUUID(), tenantId, slug, nome],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }

    toast.success(editingCategoryId ? t("Categoria atualizada") : t("Categoria adicionada"));
    setCategoryForm({ nome: "" });
    setEditingCategoryId(null);
    setCategoryOpen(false);
    qc.invalidateQueries({ queryKey: ["produto-categorias", tenantId] });
    qc.invalidateQueries({ queryKey: ["produtos", tenantId] });
  };

  const deleteCategory = async (category: any) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));

    const categoryId = String(category.id);
    const slug = String(category.slug);

    if (slug === "outros") {
      return toast.error(t("A categoria 'Outros' não pode ser excluída"));
    }

    try {
      await ensureProductCategoriesSupport(tenantId);

      await serverQuery({
        sql: "UPDATE produtos SET categoria = 'outros' WHERE tenant_id = ? AND categoria = ?",
        values: [tenantId, slug],
      });

      await serverQuery({
        sql: "DELETE FROM produto_categorias WHERE id = ? AND tenant_id = ?",
        values: [categoryId, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }

    const nextFilters = new Set(cat);
    nextFilters.delete(slug);
    setCat(nextFilters);

    toast.success(t("Categoria excluída"));
    qc.invalidateQueries({ queryKey: ["produto-categorias", tenantId] });
    qc.invalidateQueries({ queryKey: ["produtos", tenantId] });
  };

  const save = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    const payload = {...form, valor_unitario: Number(form.valor_unitario)};

    if (!payload.categoria) {
      return toast.error(t("Selecione uma categoria"));
    }

    try {
      await ensureProductCategoriesSupport(tenantId);
      if (edit) {
        await serverQuery({
          sql: `UPDATE produtos
                SET nome = ?, categoria = ?, unidade = ?, valor_unitario = ?, fornecedor = ?, observacoes = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            payload.nome,
            payload.categoria,
            payload.unidade,
            payload.valor_unitario,
            payload.fornecedor || null,
            payload.observacoes || null,
            edit.id,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO produtos (id, tenant_id, nome, categoria, unidade, valor_unitario, fornecedor, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            payload.nome,
            payload.categoria,
            payload.unidade,
            payload.valor_unitario,
            payload.fornecedor || null,
            payload.observacoes || null,
          ],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Salvo!")); setOpen(false); qc.invalidateQueries({ queryKey: ["produtos"] });
  };
  const del = async (id: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "DELETE FROM produtos WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Excluído"));
    qc.invalidateQueries({ queryKey: ["produtos"] });
  };

  return (
    <div>
      <PageHeader title="Produtos & Insumos" action={<NewButton onClick={openNew} />} />
      <div className="flex gap-2 mb-3 flex-wrap">
        <SearchBar value={q} onChange={setQ} />
        <div className="w-96 max-w-full">
          <MultiSelectFilter
            title={t("Categoria(s)")}
            options={categoryOptions}
            selected={cat}
            onChange={setCat}
            emptyText={t("Nenhuma categoria")}
            selectAllText={t("Selecionar todos")}
            clearSelectionText={t("Limpar seleção")}
            headerAction={
              <Button type="button" size="sm" variant="ghost" className="h-6 px-2" onClick={openNewCategory}>
                <Plus className="h-3 w-3 mr-1" />
                {t("Nova")}
              </Button>
            }
            renderOptionActions={(option) => {
              const category = categoryBySlug.get(option.value);
              if (!category) return null;
              const usageCount = categoryUsageBySlug.get(option.value) ?? 0;
              const deleteLabel = usageCount > 0
                ? t("Excluir categoria e mover produtos para 'Outros'")
                : t("Excluir categoria");
              return (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openEditCategory(category);
                          }}
                          aria-label={t("Editar categoria")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("Editar categoria")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/30 dark:hover:text-red-300"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            const ok = globalThis.confirm(deleteLabel);
                            if (!ok) return;
                            void deleteCategory(category);
                          }}
                          aria-label={deleteLabel}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{deleteLabel}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              );
            }}
          />
        </div>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Nome")}</TableHead><TableHead>{t("Categoria")}</TableHead><TableHead>{t("Unidade")}</TableHead><TableHead>{t("Valor")}</TableHead><TableHead>{t("Fornecedor")}</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="capitalize">{categoryNameBySlug.get(String(r.categoria)) ?? String(r.categoria).replace(/_/g, " ")}</TableCell>
                <TableCell>{r.unidade}</TableCell>
                <TableCell>{fmtBRL(r.valor_unitario)}</TableCell>
                <TableCell>{r.fornecedor}</TableCell>
                <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={t("Editar produto")}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>{t("Editar produto")}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <ConfirmDelete onConfirm={() => del(r.id)} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("Nenhum produto.")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar produto" : "Novo produto"} onSubmit={save}>
        <div><Label>{t("Nome")}</Label><Input required value={form.nome} onChange={(e)=>setForm({...form,nome:e.target.value})}/></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Categoria")}</Label>
            <Select value={form.categoria} onValueChange={(v)=>setForm({...form,categoria:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>
                {categoryRows.map((item: any) => (
                  <SelectItem key={item.id} value={item.slug}>{item.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("Unidade")}</Label>
            <Select value={form.unidade} onValueChange={(v)=>setForm({...form,unidade:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent>{["m²","metro","peça","kg","litro","rolo","caixa","un"].map((u)=><SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Valor unitário")}</Label><CurrencyInput value={form.valor_unitario} onValueChange={(value)=>setForm({...form,valor_unitario:value})}/></div>
          <div><Label>{t("Fornecedor")}</Label><Input value={form.fornecedor} onChange={(e)=>setForm({...form,fornecedor:e.target.value})}/></div>
        </div>
        <div><Label>{t("Observações")}</Label><Textarea value={form.observacoes} onChange={(e)=>setForm({...form,observacoes:e.target.value})}/></div>
      </FormDialog>

      <FormDialog
        open={categoryOpen}
        onOpenChange={(value) => {
          setCategoryOpen(value);
          if (!value) {
            setEditingCategoryId(null);
            setCategoryForm({ nome: "" });
          }
        }}
        title={editingCategoryId ? t("Editar categoria") : t("Nova categoria")}
        onSubmit={saveCategory}
      >
        <div>
          <Label>{t("Nome da categoria")}</Label>
          <Input
            required
            value={categoryForm.nome}
            onChange={(e) => setCategoryForm({ nome: e.target.value })}
            placeholder={t("Ex.: Ferramentas")}
          />
        </div>
      </FormDialog>
    </div>
  );
}
