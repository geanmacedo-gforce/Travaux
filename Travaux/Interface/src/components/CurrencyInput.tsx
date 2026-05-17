import { forwardRef } from "react";
import { Input } from "@/components/ui/input";
import { useTenantSettings } from "@/lib/tenant-settings";

type CurrencyInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  value: number | string | null | undefined;
  onValueChange: (value: number) => void;
};

function normalizeNumber(value: number | string | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatCurrencyValue(value: number, locale: string, currency: string) {
  return value.toLocaleString(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  { value, onValueChange, ...props },
  ref,
) {
  const { settings } = useTenantSettings();
  const numericValue = normalizeNumber(value);
  const displayValue = formatCurrencyValue(numericValue, settings.language_code, settings.currency_code);

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      value={displayValue}
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "");
        const nextValue = digits ? Number(digits) / 100 : 0;
        onValueChange(nextValue);
      }}
    />
  );
});
