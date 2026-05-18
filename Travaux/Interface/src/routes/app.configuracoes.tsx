import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/crud";
import { RequireAuth } from "@/components/RequireAuth";
import { CURRENCY_OPTIONS, LANGUAGE_OPTIONS, TIMEZONE_OPTIONS, useTenantSettings } from "@/lib/tenant-settings";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/app/configuracoes")({ component: Page });

function Page() {
  const { settings, saveSettings, loading } = useTenantSettings();
  const { t } = useI18n();
  const [form, setForm] = useState({
    currency_code: settings.currency_code,
    language_code: settings.language_code,
    timezone_code: settings.timezone_code,
    bot_permite_checkin_fora_raio: settings.bot_permite_checkin_fora_raio,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      currency_code: settings.currency_code,
      language_code: settings.language_code,
      timezone_code: settings.timezone_code,
      bot_permite_checkin_fora_raio: settings.bot_permite_checkin_fora_raio,
    });
  }, [settings.currency_code, settings.language_code, settings.timezone_code, settings.bot_permite_checkin_fora_raio]);

  const onSave = async () => {
    setSaving(true);
    try {
      await saveSettings(form);
      toast.success(t("Configurações do tenant atualizadas"));
    } catch (error) {
      toast.error((error as Error).message || t("Falha ao salvar configurações"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequireAuth roles={["proprietario", "admin"]}>
      <div>
        <PageHeader title="Configurações do Tenant" />
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>{t("Preferências do portal")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>{t("Moeda")}</Label>
              <Select
                value={form.currency_code}
                onValueChange={(value) =>
                  setForm({ ...form, currency_code: value as typeof form.currency_code })
                }
                disabled={loading || saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("Linguagem do portal")}</Label>
              <Select
                value={form.language_code}
                onValueChange={(value) =>
                  setForm({ ...form, language_code: value as typeof form.language_code })
                }
                disabled={loading || saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("Fuso horário")}</Label>
              <Select
                value={form.timezone_code}
                onValueChange={(value) =>
                  setForm({ ...form, timezone_code: value as typeof form.timezone_code })
                }
                disabled={loading || saving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {t(option.label)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label>{t("Permitir check-in fora do raio")}</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("Quando ativado, o bot permite continuar o check-in mesmo distante da obra, mediante confirmação do funcionário.")}
                  </p>
                </div>
                <Switch
                  checked={Boolean(form.bot_permite_checkin_fora_raio)}
                  onCheckedChange={(checked) =>
                    setForm({ ...form, bot_permite_checkin_fora_raio: checked })
                  }
                  disabled={loading || saving}
                  aria-label={t("Permitir check-in fora do raio")}
                />
              </div>
            </div>

            <Button onClick={onSave} disabled={loading || saving}>
              {saving ? t("Salvando...") || "Salvando..." : t("Salvar configurações")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </RequireAuth>
  );
}
