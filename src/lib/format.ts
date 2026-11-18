export function formatPrice(value: number, market: "crypto" | "stock" = "stock") {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  const digits =
    market === "crypto"
      ? abs >= 1000
        ? 2
        : abs >= 1
          ? 4
          : 6
      : abs >= 1000
        ? 2
        : abs >= 1
          ? 2
          : 4;

  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatSigned(value: number, market: "crypto" | "stock" = "stock") {
  if (!Number.isFinite(value)) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${formatPrice(value, market)}`;
}

export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}
