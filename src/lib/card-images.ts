import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { CardTemplate } from "./types";

/**
 * Banque d'images des cartes : fichiers déposés dans public/cards/<catégorie>/.
 * Ordre de résolution (le premier qui existe gagne) :
 *   1. card_templates.image_url (URL ou chemin explicite en base)
 *   2. <code>.webp|png|jpg|jpeg|avif        image propre à la carte      (ex. boite/b10.webp)
 *   3. _<famille>.webp ...                  image générique de la famille (ex. moteur/_v8.webp)
 *   4. _<famille de base>.webp ...          repli moins précis           (ex. moteur/_6-cylindres.webp)
 *   5. _default.webp ...                    image par défaut de la catégorie
 *   6. null → l'interface affiche une icône
 * Famille = architecture (moteur), type de boîte, type de pneu ou effet du bonus.
 */

const ROOT = path.join(process.cwd(), "public", "cards");
const EXTENSIONS = new Set([".webp", ".png", ".jpg", ".jpeg", ".avif", ".svg"]);
const CACHE_MS = 3000;

const cache = new Map<string, { at: number; files: Map<string, string> }>();

/** Nom sans extension → nom de fichier, pour un dossier (mis en cache quelques secondes). */
function listDir(dir: string): Map<string, string> {
  const hit = cache.get(dir);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.files;
  const files = new Map<string, string>();
  try {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      const ext = path.extname(f).toLowerCase();
      if (EXTENSIONS.has(ext)) files.set(path.basename(f, path.extname(f)).toLowerCase(), f);
    }
  } catch {
    // dossier absent : pas d'images
  }
  cache.set(dir, { at: Date.now(), files });
  return files;
}

/** "4 cylindres" → "4-cylindres", "V8" → "v8", "Double embrayage" → "double-embrayage". */
export const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const DIR: Record<CardTemplate["category"], string> = { moteur: "moteur", boite: "boite", pneus: "pneus", bonus: "bonus" };

function family(t: CardTemplate): string | null {
  switch (t.category) {
    case "moteur": return t.architecture;
    case "boite": return t.gearbox_type;
    case "pneus": return t.tire_type;
    default: return t.bonus_effect;
  }
}

/** "6 cylindres en ligne" → ["_6-cylindres-en-ligne", "_6-cylindres"] ; "V8" → ["_v8"]. */
function familyKeys(fam: string): string[] {
  const s = slug(fam);
  const keys = [`_${s}`];
  const base = s.match(/^(\d+)-cylindres(?:-|$)/);
  if (base && `_${base[1]}-cylindres` !== keys[0]) keys.push(`_${base[1]}-cylindres`);
  return keys;
}

export function cardImageUrl(t: CardTemplate): string | null {
  if (t.image_url) return t.image_url;
  const dir = DIR[t.category];
  const files = listDir(dir);
  if (files.size === 0) return null;

  const fam = family(t);
  const candidates = [t.code?.toLowerCase(), ...(fam ? familyKeys(fam) : []), "_default"];
  for (const key of candidates) {
    const file = key ? files.get(key) : undefined;
    if (file) return `/cards/${dir}/${file}`;
  }
  return null;
}
