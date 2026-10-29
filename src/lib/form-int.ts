const INTEGER_RE = /^\d+$/;
const PG_INT_MAX = 2_147_483_647;

/**
 * Parse un entier de formulaire de façon stricte.
 * - chaîne vide → null ;
 * - valeur non numérique, négative, décimale ou hors plage integer → throw du code métier fourni.
 * Le code levé est ensuite traduit par rpcErrorMessage.
 */
export function parseFormInt(value: string, errorCode = "invalid_number"): number | null {
  const raw = value.trim();
  if (raw === "") return null;
  if (!INTEGER_RE.test(raw)) throw new Error(errorCode);

  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n > PG_INT_MAX) throw new Error(errorCode);
  return n;
}
