let activeLocale = "pt-BR";
let activeCurrency = "BRL";
let activeTimeZone = "America/Sao_Paulo";

export function setFormatPreferences(input: { locale?: string; currency?: string; timezone?: string }) {
  activeLocale = input.locale || "pt-BR";
  activeCurrency = input.currency || "BRL";
  activeTimeZone = input.timezone || "America/Sao_Paulo";
}

function parseDateInput(value: string | Date) {
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return new Date(NaN);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return new Date(`${raw}T00:00:00`);
  }

  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/.test(raw)) {
    // Treat SQL DATETIME without explicit offset as UTC.
    return new Date(raw.replace(" ", "T") + "Z");
  }

  return new Date(raw);
}

function safeDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const parsed = parseDateInput(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const fmtBRL = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString(activeLocale, { style: "currency", currency: activeCurrency });

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  const date = safeDate(d);
  if (!date) return "-";
  return date.toLocaleDateString(activeLocale, { timeZone: activeTimeZone });
};

export const fmtDateTime = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  const date = safeDate(d);
  if (!date) return "-";
  return date.toLocaleString(activeLocale, {
    timeZone: activeTimeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const fmtDateTimeInputValue = (d: string | Date | null | undefined) => {
  if (!d) return "";
  const date = safeDate(d);
  if (!date) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: activeTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
};

export const fmtHours = (value: number | string | null | undefined) => {
  const total = Number(value ?? 0);
  if (!Number.isFinite(total) || total <= 0) return "0h";

  const hours = Math.floor(total);
  const minutes = Math.round((total - hours) * 60);

  if (minutes === 60) return `${hours + 1}h`;
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
};

export const maskCPFCNPJ = (v: string) => {
  const x = v.replace(/\D/g, "").slice(0, 14);
  if (x.length <= 11) return x.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return x.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
};
export const maskPhone = (v: string) => {
  const x = v.replace(/\D/g, "").slice(0, 11);
  if (x.length <= 10) return x.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return x.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};
export const maskCEP = (v: string) => v.replace(/\D/g, "").slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
