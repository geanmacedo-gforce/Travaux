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
import { PageHeader, SearchBar, FormDialog, ConfirmDelete, NewButton } from "@/components/crud";
import { maskCPFCNPJ, maskPhone, fmtBRL } from "@/lib/format";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/funcionarios")({ component: Page });
const empty = { nome:"", cpf:"", pais_codigo:"55", telefone:"", funcao:"auxiliar", tipo_remuneracao:"hora", valor:0, banco:"", agencia:"", conta:"", pix:"", status:"ativo", observacoes:"" };

const COUNTRY_CODES = [
  { code: "55", label: "Brasil (+55)" },
  { code: "1", label: "USA/Canadá (+1)" },
  { code: "34", label: "Espanha (+34)" },
  { code: "351", label: "Portugal (+351)" },
  { code: "44", label: "Reino Unido (+44)" },
  { code: "33", label: "França (+33)" },
  { code: "49", label: "Alemanha (+49)" },
  { code: "39", label: "Itália (+39)" },
];

function Page() {
  const { user } = useAuth();
  const { t, tEnum } = useI18n();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const [form, setForm] = useState<any>(empty);

  // Função para extrair código de país do telefone salvo no BD
  const parsePhoneWithCountry = (storedPhone: string) => {
    if (!storedPhone) return { pais_codigo: "55", telefone: "" };
    const digits = storedPhone.replace(/\D/g, "");
    
    // Procura pelo código de país mais longo que bata
    for (const country of COUNTRY_CODES.sort((a, b) => b.code.length - a.code.length)) {
      if (digits.startsWith(country.code)) {
        return {
          pais_codigo: country.code,
          telefone: digits.substring(country.code.length),
        };
      }
    }
    
    // Se não encontrar, assume Brasil
    return { pais_codigo: "55", telefone: digits };
  };

  const { data: rows = [] } = useQuery({
    queryKey: ["funcionarios", tenantId],
    queryFn: async () => (await serverQuery({
      sql: "SELECT * FROM funcionarios WHERE tenant_id = ? ORDER BY nome",
      values: [tenantId],
    })) ?? [],
    enabled: Boolean(tenantId),
  });
  const filtered = rows.filter((r: any) => r.nome.toLowerCase().includes(q.toLowerCase()));

  const openNew = () => { setEdit(null); setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setEdit(r);
    const { pais_codigo, telefone } = parsePhoneWithCountry(r.telefone);
    setForm({...r, pais_codigo, telefone});
    setOpen(true);
  };
  const save = async () => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    // Combinar código de país com telefone, removendo todos os caracteres não numéricos
    const telefoneSemMascara = form.telefone.replace(/\D/g, "");
    const telefoneFinal = telefoneSemMascara ? `${form.pais_codigo}${telefoneSemMascara}` : null;
    const payload = { ...form, valor: Number(form.valor), telefone: telefoneFinal };
    try {
      if (edit) {
        await serverQuery({
          sql: `UPDATE funcionarios
                SET nome = ?, cpf = ?, telefone = ?, funcao = ?, tipo_remuneracao = ?, valor = ?, banco = ?, agencia = ?, conta = ?, pix = ?, status = ?, observacoes = ?
                WHERE id = ? AND tenant_id = ?`,
          values: [
            payload.nome,
            payload.cpf || null,
            payload.telefone,
            payload.funcao,
            payload.tipo_remuneracao,
            payload.valor,
            payload.banco || null,
            payload.agencia || null,
            payload.conta || null,
            payload.pix || null,
            payload.status,
            payload.observacoes || null,
            edit.id,
            tenantId,
          ],
        });
      } else {
        await serverQuery({
          sql: `INSERT INTO funcionarios (id, tenant_id, nome, cpf, telefone, funcao, tipo_remuneracao, valor, banco, agencia, conta, pix, status, observacoes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          values: [
            crypto.randomUUID(),
            tenantId,
            payload.nome,
            payload.cpf || null,
            payload.telefone,
            payload.funcao,
            payload.tipo_remuneracao,
            payload.valor,
            payload.banco || null,
            payload.agencia || null,
            payload.conta || null,
            payload.pix || null,
            payload.status,
            payload.observacoes || null,
          ],
        });
      }
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Salvo!")); setOpen(false); qc.invalidateQueries({ queryKey: ["funcionarios"] });
  };
  const del = async (id: string) => {
    if (!tenantId) return toast.error(t("Tenant nao identificado na sessao."));
    try {
      await serverQuery({
        sql: "DELETE FROM funcionarios WHERE id = ? AND tenant_id = ?",
        values: [id, tenantId],
      });
    } catch (error) {
      return toast.error((error as Error).message);
    }
    toast.success(t("Excluído"));
    qc.invalidateQueries({ queryKey: ["funcionarios"] });
  };

  return (
    <div>
      <PageHeader title="Funcionários" action={<NewButton onClick={openNew} />} />
      <SearchBar value={q} onChange={setQ} placeholder="Buscar por nome..." />
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow><TableHead>{t("Nome")}</TableHead><TableHead>{t("Função")}</TableHead><TableHead>{t("Remuneração")}</TableHead><TableHead>{t("Status")}</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.nome}</TableCell>
                <TableCell className="capitalize">{tEnum(r.funcao)}</TableCell>
                <TableCell>{fmtBRL(r.valor)}/{r.tipo_remuneracao === "hora" ? t("hora") : r.tipo_remuneracao === "diaria" ? t("diaria") : t("mensal")}</TableCell>
                <TableCell className="capitalize">{tEnum(r.status)}</TableCell>
                <TableCell className="text-right inline-flex items-center gap-1 justify-end w-full">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={t("Editar funcionário")}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <ConfirmDelete onConfirm={() => del(r.id)} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t("Nenhum funcionário.")}</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <FormDialog open={open} onOpenChange={setOpen} title={edit ? "Editar funcionário" : "Novo funcionário"} onSubmit={save}>
        <div><Label>{t("Nome")}</Label><Input required value={form.nome} onChange={(e)=>setForm({...form,nome:e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("CPF")}</Label><Input value={form.cpf} onChange={(e)=>setForm({...form,cpf:maskCPFCNPJ(e.target.value)})} /></div>
          <div><Label>{t("Telefone")}</Label>
            <div className="flex gap-2">
              <Select value={form.pais_codigo} onValueChange={(v)=>setForm({...form,pais_codigo:v})}>
                <SelectTrigger className="w-24"><SelectValue/></SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>{c.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input placeholder="9 dígitos" value={form.telefone} onChange={(e)=>setForm({...form,telefone:e.target.value.replace(/\D/g,'')})} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>{t("Função")}</Label>
            <Select value={form.funcao} onValueChange={(v)=>setForm({...form,funcao:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="drywall">Drywall</SelectItem><SelectItem value="masticagem">{t("Masticagem")}</SelectItem><SelectItem value="auxiliar">{t("Auxiliar")}</SelectItem><SelectItem value="outro">{t("Outro")}</SelectItem></SelectContent>
            </Select></div>
          <div><Label>{t("Remuneração")}</Label>
            <Select value={form.tipo_remuneracao} onValueChange={(v)=>setForm({...form,tipo_remuneracao:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="hora">{t("Por hora")}</SelectItem><SelectItem value="diaria">{t("Por diária")}</SelectItem><SelectItem value="mensal">{t("Salário fixo")}</SelectItem></SelectContent>
            </Select></div>
          <div><Label>{t("Valor")}</Label><CurrencyInput value={form.valor} onValueChange={(value)=>setForm({...form,valor:value})} /></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Label>{t("Banco")}</Label><Input value={form.banco} onChange={(e)=>setForm({...form,banco:e.target.value})}/></div>
          <div><Label>{t("Agência")}</Label><Input value={form.agencia} onChange={(e)=>setForm({...form,agencia:e.target.value})}/></div>
          <div><Label>{t("Conta")}</Label><Input value={form.conta} onChange={(e)=>setForm({...form,conta:e.target.value})}/></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label>{t("Pix")}</Label><Input value={form.pix} onChange={(e)=>setForm({...form,pix:e.target.value})}/></div>
          <div><Label>{t("Status")}</Label>
            <Select value={form.status} onValueChange={(v)=>setForm({...form,status:v})}>
              <SelectTrigger><SelectValue/></SelectTrigger>
              <SelectContent><SelectItem value="ativo">{t("Ativo")}</SelectItem><SelectItem value="afastado">{t("Afastado")}</SelectItem><SelectItem value="desligado">{t("Desligado")}</SelectItem></SelectContent>
            </Select></div>
        </div>
        <div><Label>{t("Observações")}</Label><Textarea value={form.observacoes} onChange={(e)=>setForm({...form,observacoes:e.target.value})}/></div>
      </FormDialog>
    </div>
  );
}
