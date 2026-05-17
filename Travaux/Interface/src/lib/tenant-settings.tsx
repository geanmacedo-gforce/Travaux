import { createContext, useContext, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { serverQuery, serverQueryOne } from "@/lib/server-api";
import { setFormatPreferences } from "@/lib/format";

export const CURRENCY_OPTIONS = [
  { value: "BRL", label: "Reais", locale: "pt-BR" },
  { value: "USD", label: "Dolar", locale: "en-US" },
  { value: "EUR", label: "Euro", locale: "fr-FR" },
  { value: "ARS", label: "Peso", locale: "es-AR" },
] as const;

export const LANGUAGE_OPTIONS = [
  { value: "pt-BR", label: "Portugues" },
  { value: "en-US", label: "Ingles" },
  { value: "fr-FR", label: "Frances" },
  { value: "de-DE", label: "Alemao" },
  { value: "es-ES", label: "Espanhol" },
] as const;

type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]["value"];
type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["value"];

type TenantSettings = {
  nome: string;
  currency_code: CurrencyCode;
  language_code: LanguageCode;
  bot_permite_checkin_fora_raio: boolean;
};

type TenantSettingsContextValue = {
  settings: TenantSettings;
  loading: boolean;
  saveSettings: (input: {
    currency_code: CurrencyCode;
    language_code: LanguageCode;
    bot_permite_checkin_fora_raio: boolean;
  }) => Promise<void>;
};

const DEFAULT_SETTINGS: TenantSettings = {
  nome: "Travaux",
  currency_code: "BRL",
  language_code: "pt-BR",
  bot_permite_checkin_fora_raio: false,
};

const TenantSettingsContext = createContext<TenantSettingsContextValue | null>(null);

async function ensureTenantSettingsColumns() {
  try {
    await serverQuery({ sql: "ALTER TABLE tenants ADD COLUMN currency_code VARCHAR(10) NULL DEFAULT 'BRL'" });
  } catch {}
  try {
    await serverQuery({ sql: "ALTER TABLE tenants ADD COLUMN language_code VARCHAR(10) NULL DEFAULT 'pt-BR'" });
  } catch {}
  try {
    await serverQuery({ sql: "ALTER TABLE tenants ADD COLUMN bot_permite_checkin_fora_raio TINYINT(1) NOT NULL DEFAULT 0" });
  } catch {}
}

export function TenantSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const tenantId = user?.tenant_id ?? "";
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant-settings", tenantId],
    queryFn: async () => {
      await ensureTenantSettingsColumns();
      const row = await serverQueryOne<any>({
        sql: `SELECT nome,
                     COALESCE(currency_code, 'BRL') AS currency_code,
                     COALESCE(language_code, 'pt-BR') AS language_code,
                     COALESCE(bot_permite_checkin_fora_raio, 0) AS bot_permite_checkin_fora_raio
              FROM tenants
              WHERE id = ?
              LIMIT 1`,
        values: [tenantId],
      });
      return {
        ...DEFAULT_SETTINGS,
        ...row,
        bot_permite_checkin_fora_raio: Boolean(Number(row?.bot_permite_checkin_fora_raio ?? 0)),
      } as TenantSettings;
    },
    enabled: Boolean(tenantId),
  });

  const settings = data ?? DEFAULT_SETTINGS;

  useEffect(() => {
    setFormatPreferences({
      currency: settings.currency_code,
      locale: settings.language_code,
    });
    if (typeof document !== "undefined") {
      document.documentElement.lang = settings.language_code;
    }
  }, [settings.currency_code, settings.language_code]);

  const value = useMemo<TenantSettingsContextValue>(() => ({
    settings,
    loading: isLoading,
    saveSettings: async (input) => {
      if (!tenantId) return;
      await ensureTenantSettingsColumns();
      await serverQuery({
        sql: `UPDATE tenants
              SET currency_code = ?, language_code = ?, bot_permite_checkin_fora_raio = ?
              WHERE id = ?`,
        values: [
          input.currency_code,
          input.language_code,
          input.bot_permite_checkin_fora_raio ? 1 : 0,
          tenantId,
        ],
      });
      await qc.invalidateQueries({ queryKey: ["tenant-settings", tenantId] });
      await qc.invalidateQueries({ queryKey: ["sidebar-tenant", tenantId] });
    },
  }), [settings, isLoading, tenantId, qc]);

  return <TenantSettingsContext.Provider value={value}>{children}</TenantSettingsContext.Provider>;
}

export function useTenantSettings() {
  const context = useContext(TenantSettingsContext);
  if (!context) throw new Error("useTenantSettings must be used within TenantSettingsProvider");
  return context;
}
