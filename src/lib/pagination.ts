/** Pagination : valeur entière, positive et bornée. Politique : 1 par défaut, décimales tronquées. */
export const PAGE_MAX = 1000;

export function parsePage(value: unknown, max = PAGE_MAX): number {
  if (value === undefined || value === null || value === "") return 1;

  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : Number.NaN;
  if (!Number.isFinite(n)) return 1;

  const page = Math.floor(n);
  if (page < 1) return 1;

  const ceiling = Number.isFinite(max) ? Math.max(1, Math.floor(max)) : PAGE_MAX;
  return Math.min(page, ceiling);
}
