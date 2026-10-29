/**
 * Résolution de l'IP client derrière un ou plusieurs reverse proxies de confiance.
 *
 * `x-forwarded-for` est une chaîne « client, proxy1, proxy2... » où chaque proxy
 * ajoute l'adresse qu'il a vue. Le premier maillon est donc librement forgé par
 * le client : il ne doit jamais servir de clé de rate limiting.
 *
 * `TRUSTED_PROXY_COUNT` indique le nombre de proxies de confiance placés devant
 * l'application. On lit le maillon correspondant en partant de la droite :
 *   - 1 proxy  → dernier maillon ;
 *   - 2 proxies → avant-dernier maillon ;
 *   - absent ou 0 → aucune valeur de l'en-tête n'est fiable : repli sur "unknown".
 *
 * Conséquence du repli "unknown" : sans proxy configuré, toutes les requêtes
 * partagent le même compteur de rate limiting. En production, définir
 * `TRUSTED_PROXY_COUNT=1` (ou plus) derrière un reverse proxy.
 */

const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;
const NUMERIC_LABEL_RE = /^[0-9.]+$/;
const HOSTNAME_RE =
  /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/;

function isIpv6(value: string): boolean {
  if (!value.includes(":") || value.includes(":::") || !/^[0-9a-fA-F:]+$/.test(value)) return false;
  const groups = value.split(":");
  return groups.length >= 3 && groups.length <= 9 && groups.every((group) => group.length <= 4);
}

/** Vrai si la valeur ressemble à une IP valide ou à un hostname raisonnable. */
export function isPlausibleClientAddress(value: string): boolean {
  if (IPV4_RE.test(value) || isIpv6(value)) return true;
  // Une suite purement numérique de type « 999.999.999.999 » n'est pas un hostname.
  if (NUMERIC_LABEL_RE.test(value)) return false;
  return HOSTNAME_RE.test(value);
}

export function parseTrustedProxyCount(value: unknown): number {
  if (value === undefined || value === null || value === "") return 0;
  const n = typeof value === "number" ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
}

/**
 * Retourne l'adresse client fiable, ou "unknown" si l'en-tête est absent,
 * trop court pour le nombre de proxies déclaré, ou contient une valeur invalide.
 */
export function resolveClientIp(xff: string | null | undefined, trustedProxyCount: unknown): string {
  const count = parseTrustedProxyCount(trustedProxyCount);
  if (count < 1) return "unknown";

  const parts = String(xff ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length < count) return "unknown";
  const candidate = parts[parts.length - count];
  return isPlausibleClientAddress(candidate) ? candidate : "unknown";
}
