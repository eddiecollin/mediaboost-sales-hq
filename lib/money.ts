export function formatEuro(cents: number | null | undefined) {
  const safeCents = Number.isFinite(cents ?? 0) ? Number(cents ?? 0) : 0;
  const euros = safeCents / 100;
  return `${new Intl.NumberFormat("fi-FI", {
    maximumFractionDigits: euros % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0
  }).format(euros)} €`;
}

export function euroToCents(value: string | number) {
  const parsed = typeof value === "number" ? value : Number(value.replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}
