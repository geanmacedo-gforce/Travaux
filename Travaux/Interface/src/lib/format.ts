let activeLocale = "pt-BR";
let activeCurrency = "BRL";

export function setFormatPreferences(input: { locale?: string; currency?: string }) {
  activeLocale = input.locale || "pt-BR";
  activeCurrency = input.currency || "BRL";
}

export const fmtBRL = (n: number | null | undefined) =>
  (Number(n ?? 0)).toLocaleString(activeLocale, { style: "currency", currency: activeCurrency });

export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d + (d.length === 10 ? "T00:00:00" : "")) : d;
  return date.toLocaleDateString(activeLocale);
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
