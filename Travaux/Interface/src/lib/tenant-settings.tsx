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

export const TIMEZONE_OPTIONS = [
  { value: "America/Sao_Paulo", label: "Brasil (Sao Paulo)" },
  { value: "America/Manaus", label: "Brasil (Manaus)" },
  { value: "America/Belem", label: "Brasil (Belem)" },
  { value: "America/Fortaleza", label: "Brasil (Fortaleza)" },
  { value: "America/Rio_Branco", label: "Brasil (Rio Branco)" },
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Bogota", label: "Colombia (Bogota)" },
  { value: "America/Mexico_City", label: "Mexico (Cidade do Mexico)" },
  { value: "America/New_York", label: "Estados Unidos (New York)" },
  { value: "America/Los_Angeles", label: "Estados Unidos (Los Angeles)" },
  { value: "Europe/Amsterdam", label: "Paises Baixos (Amsterda)" },
  { value: "Europe/Andorra", label: "Andorra" },
  { value: "Europe/Athens", label: "Grecia (Atenas)" },
  { value: "Europe/Belgrade", label: "Servia (Belgrado)" },
  { value: "Europe/Berlin", label: "Alemanha (Berlim)" },
  { value: "Europe/Bratislava", label: "Eslovaquia (Bratislava)" },
  { value: "Europe/Brussels", label: "Belgica (Bruxelas)" },
  { value: "Europe/Bucharest", label: "Romania (Bucareste)" },
  { value: "Europe/Budapest", label: "Hungria (Budapeste)" },
  { value: "Europe/Chisinau", label: "Moldavia (Chisinau)" },
  { value: "Europe/Copenhagen", label: "Dinamarca (Copenhague)" },
  { value: "Europe/Dublin", label: "Irlanda (Dublin)" },
  { value: "Europe/Gibraltar", label: "Gibraltar" },
  { value: "Europe/Helsinki", label: "Finlandia (Helsinque)" },
  { value: "Europe/Istanbul", label: "Turquia (Istambul)" },
  { value: "Europe/Kaliningrad", label: "Russia (Kaliningrado)" },
  { value: "Europe/Kyiv", label: "Ucrania (Kyiv)" },
  { value: "Europe/Lisbon", label: "Portugal (Lisboa)" },
  { value: "Europe/London", label: "Reino Unido (Londres)" },
  { value: "Europe/Luxembourg", label: "Luxemburgo" },
  { value: "Europe/Madrid", label: "Espanha (Madri)" },
  { value: "Europe/Malta", label: "Malta" },
  { value: "Europe/Minsk", label: "Belarus (Minsk)" },
  { value: "Europe/Monaco", label: "Monaco" },
  { value: "Europe/Moscow", label: "Russia (Moscou)" },
  { value: "Europe/Oslo", label: "Noruega (Oslo)" },
  { value: "Europe/Paris", label: "Franca (Paris)" },
  { value: "Europe/Prague", label: "Republica Tcheca (Praga)" },
  { value: "Europe/Riga", label: "Letonia (Riga)" },
  { value: "Europe/Rome", label: "Italia (Roma)" },
  { value: "Europe/Samara", label: "Russia (Samara)" },
  { value: "Europe/Sarajevo", label: "Bosnia e Herzegovina (Sarajevo)" },
  { value: "Europe/Skopje", label: "Macedonia do Norte (Skopje)" },
  { value: "Europe/Sofia", label: "Bulgaria (Sofia)" },
  { value: "Europe/Stockholm", label: "Suecia (Estocolmo)" },
  { value: "Europe/Tallinn", label: "Estonia (Tallinn)" },
  { value: "Europe/Tirane", label: "Albania (Tirana)" },
  { value: "Europe/Vaduz", label: "Liechtenstein (Vaduz)" },
  { value: "Europe/Vienna", label: "Austria (Viena)" },
  { value: "Europe/Vilnius", label: "Lituania (Vilnius)" },
  { value: "Europe/Volgograd", label: "Russia (Volgogrado)" },
  { value: "Europe/Warsaw", label: "Polonia (Varsovia)" },
  { value: "Europe/Zagreb", label: "Croacia (Zagreb)" },
  { value: "Europe/Zurich", label: "Suica (Zurique)" },
  { value: "Atlantic/Reykjavik", label: "Islandia (Reykjavik)" },
  { value: "Atlantic/Faroe", label: "Ilhas Faroe" },
  { value: "Atlantic/Azores", label: "Portugal (Acores)" },
  { value: "Atlantic/Madeira", label: "Portugal (Madeira)" },
  { value: "Africa/Luanda", label: "Angola (Luanda)" },
  { value: "Asia/Dubai", label: "Emirados Arabes (Dubai)" },
] as const;

type CurrencyCode = (typeof CURRENCY_OPTIONS)[number]["value"];
type LanguageCode = (typeof LANGUAGE_OPTIONS)[number]["value"];
type TimezoneCode = (typeof TIMEZONE_OPTIONS)[number]["value"];

type TenantSettings = {
  nome: string;
  currency_code: CurrencyCode;
  language_code: LanguageCode;
  timezone_code: TimezoneCode;
  bot_permite_checkin_fora_raio: boolean;
};

type TenantSettingsContextValue = {
  settings: TenantSettings;
  loading: boolean;
  saveSettings: (input: {
    currency_code: CurrencyCode;
    language_code: LanguageCode;
    timezone_code: TimezoneCode;
    bot_permite_checkin_fora_raio: boolean;
  }) => Promise<void>;
};

const DEFAULT_SETTINGS: TenantSettings = {
  nome: "Travaux",
  currency_code: "BRL",
  language_code: "pt-BR",
  timezone_code: "America/Sao_Paulo",
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
    await serverQuery({ sql: "ALTER TABLE tenants ADD COLUMN timezone_code VARCHAR(80) NULL DEFAULT 'America/Sao_Paulo'" });
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
            COALESCE(timezone_code, 'America/Sao_Paulo') AS timezone_code,
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
      timezone: settings.timezone_code,
    });
    if (typeof document !== "undefined") {
      document.documentElement.lang = settings.language_code;
    }
  }, [settings.currency_code, settings.language_code, settings.timezone_code]);

  const value = useMemo<TenantSettingsContextValue>(() => ({
    settings,
    loading: isLoading,
    saveSettings: async (input) => {
      if (!tenantId) return;
      await ensureTenantSettingsColumns();
      await serverQuery({
        sql: `UPDATE tenants
              SET currency_code = ?, language_code = ?, timezone_code = ?, bot_permite_checkin_fora_raio = ?
              WHERE id = ?`,
        values: [
          input.currency_code,
          input.language_code,
          input.timezone_code,
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
