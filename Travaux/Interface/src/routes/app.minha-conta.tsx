import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/crud";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { serverChangeOwnPassword, serverQuery, serverQueryOne } from "@/lib/server-api";
import { Upload } from "lucide-react";

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Falha ao ler a imagem anexada."));
    reader.readAsDataURL(file);
  });
}

export const Route = createFileRoute("/app/minha-conta")({ component: Page });

type AccountRow = {
  nome: string;
  email: string;
  endereco: string | null;
  avatar_url: string | null;
};

function getInitial(name?: string | null) {
  const clean = String(name ?? "").trim();
  return clean ? clean.charAt(0).toUpperCase() : "U";
}

function Page() {
  const { user, refresh } = useAuth();
  const tenantId = user?.tenant_id ?? "";
  const userId = user?.id ?? "";
  const qc = useQueryClient();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [endereco, setEndereco] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    const ensureColumns = async () => {
      if (!tenantId) return;
      try {
        await serverQuery({ sql: "ALTER TABLE profiles ADD COLUMN endereco VARCHAR(255) NULL" });
      } catch {
        // no-op when the column already exists
      }
      try {
        await serverQuery({ sql: "ALTER TABLE profiles ADD COLUMN avatar_url VARCHAR(1024) NULL" });
      } catch {
        // no-op when the column already exists
      }
    };
    void ensureColumns();
  }, [tenantId]);

  const { data, isLoading } = useQuery({
    queryKey: ["my-account", tenantId, userId],
    enabled: Boolean(tenantId && userId),
    queryFn: async () => {
      const row = await serverQueryOne<AccountRow>({
        sql: "SELECT nome, email, endereco, avatar_url FROM profiles WHERE user_id = ? AND tenant_id = ? LIMIT 1",
        values: [userId, tenantId],
      });
      return row;
    },
  });

  useEffect(() => {
    if (!data) return;
    setNome(data.nome ?? "");
    setEmail(data.email ?? "");
    setEndereco(data.endereco ?? "");
    setAvatarUrl(data.avatar_url ?? "");
    setPreviewUrl(data.avatar_url ?? "");
    setAvatarFile(null);
  }, [data]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    try {
      const dataUrl = await fileToDataUrl(file);
      setPreviewUrl(dataUrl);
      setAvatarUrl(dataUrl);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const saveProfile = async () => {
    if (!tenantId || !userId) return toast.error("Sessão inválida.");
    if (!nome.trim() || !email.trim()) return toast.error("Preencha nome e e-mail.");

    setSavingProfile(true);
    try {
      await Promise.all([
        serverQuery({
          sql: "UPDATE profiles SET nome = ?, email = ?, endereco = ?, avatar_url = ? WHERE user_id = ? AND tenant_id = ?",
          values: [nome.trim(), email.trim(), endereco.trim() || null, avatarUrl || null, userId, tenantId],
        }),
        serverQuery({
          sql: "UPDATE users SET email = ? WHERE id = ? AND tenant_id = ?",
          values: [email.trim(), userId, tenantId],
        }),
      ]);

      await refresh();
      await qc.invalidateQueries({ queryKey: ["my-account", tenantId, userId] });
      toast.success("Dados atualizados com sucesso.");
    } catch (error) {
      toast.error((error as Error).message || "Falha ao atualizar dados.");
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!tenantId || !userId) return toast.error("Sessão inválida.");
    if (!senha.trim()) return toast.error("Informe a nova senha.");
    if (senha.length < 6) return toast.error("A senha deve ter pelo menos 6 caracteres.");
    if (senha !== confirmarSenha) return toast.error("As senhas não coincidem.");

    setSavingPassword(true);
    try {
      await serverChangeOwnPassword({ userId, tenantId, password: senha });
      setSenha("");
      setConfirmarSenha("");
      toast.success("Senha alterada com sucesso.");
    } catch (error) {
      toast.error((error as Error).message || "Falha ao alterar senha.");
    } finally {
      setSavingPassword(false);
    }
  };

  const initial = getInitial(nome || data?.nome);

  return (
    <div className="space-y-6">
      <PageHeader title="Minha Conta" />

      <Card>
        <CardHeader>
          <CardTitle>Dados do usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={previewUrl || undefined} alt={nome || "Usuário"} />
              <AvatarFallback>{initial}</AvatarFallback>
            </Avatar>
            <div className="text-sm text-muted-foreground">Clique abaixo para importar uma foto.</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input id="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} disabled={isLoading} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="avatar" className="flex items-center gap-1">
                <Upload className="h-3.5 w-3.5" />
                Foto de perfil
              </Label>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                disabled={isLoading}
              />
            </div>
          </div>

          <Button onClick={saveProfile} disabled={savingProfile || isLoading}>
            {savingProfile ? "Salvando..." : "Salvar dados"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alterar senha</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="senha">Nova senha</Label>
              <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar-senha">Confirmar senha</Label>
              <Input id="confirmar-senha" type="password" value={confirmarSenha} onChange={(e) => setConfirmarSenha(e.target.value)} />
            </div>
          </div>

          <Button onClick={savePassword} disabled={savingPassword}>
            {savingPassword ? "Alterando..." : "Salvar senha"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
