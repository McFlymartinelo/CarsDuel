import type { CardTemplate } from "@/lib/types";

/** Longueur maximale d'une recherche (borne l'URL et les requêtes SQL). */
export const SEARCH_MAX_LENGTH = 60;

/** Nettoie une saisie : espaces, « # » de référence, longueur. Vide → undefined. */
export function cleanSearch(value: string | null | undefined): string | undefined {
  const cleaned = (value ?? "").trim().replace(/^#/, "").trim().slice(0, SEARCH_MAX_LENGTH);
  return cleaned || undefined;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Une saisie qui ressemble à une référence de carte : « 1 », « 1A », « 21b »… */
const REFERENCE_RE = /^\d+[a-z]*$/i;
export const isReferenceSearch = (value: string) => REFERENCE_RE.test(value);

/**
 * Recherche locale sur une carte : nom, code (« m_1a ») ou référence (« 1a », « #1A »).
 * Une référence est comparée exactement (le code privé de son préfixe m_/b_) ;
 * les autres saisies cherchent dans le nom et le code. Insensible à la casse et aux accents.
 */
export function matchesTemplateSearch(template: Pick<CardTemplate, "name" | "code">, search: string | undefined): boolean {
  const needle = cleanSearch(search);
  if (!needle) return true;
  const code = template.code ?? "";
  const reference = normalize(code.replace(/^[mb]_?/i, ""));
  if (isReferenceSearch(needle)) {
    const n = normalize(needle);
    // « 1 » cible #1, #1A, #1B mais pas #10 ; « 1A » cible #1A, pas #21A.
    if (reference === n || (reference.startsWith(n) && /^[a-z]*$/.test(reference.slice(n.length)))) return true;
    return /[a-z]/i.test(needle) && normalize(template.name).includes(n);
  }
  return normalize(`${template.name} ${code} ${reference}`).includes(normalize(needle));
}
