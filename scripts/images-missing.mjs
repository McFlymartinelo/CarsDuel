// Liste les images manquantes de la banque (public/cards) et propose un prompt prêt à coller dans Gemini.
// Usage : npm run images:missing            → génériques manquants (architecture / type de boîte / type de pneu / bonus)
//         npm run images:missing -- --all   → inclut aussi les moteurs sans image propre (une par code)
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");
const cards = path.join(root, "public", "cards");
const EXT = new Set([".webp", ".png", ".jpg", ".jpeg", ".avif", ".svg"]);

for (const line of fs.existsSync(path.join(root, ".env.local")) ? fs.readFileSync(path.join(root, ".env.local"), "utf8").split(/\r?\n/) : []) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const have = (dir) => {
  try {
    return new Set(fs.readdirSync(path.join(cards, dir)).filter((f) => EXT.has(path.extname(f).toLowerCase())).map((f) => path.basename(f, path.extname(f)).toLowerCase()));
  } catch {
    return new Set();
  }
};

const STYLE =
  "Photorealistic studio product render, isolated on a pure black background, three-quarter view, dramatic rim lighting with subtle orange accents, highly detailed, no text, no logo, no watermark, square 1:1 image";

function engineSubject(arch) {
  const a = arch.toLowerCase();
  let m;
  if ((m = a.match(/^(\d+) cylindres en ligne/))) return `an inline ${m[1]}-cylinder car engine`;
  if ((m = a.match(/^(\d+) cylindres .* plat/))) return `a flat-${m[1]} boxer car engine`;
  if ((m = a.match(/^(\d+) cylindres en v/))) return `a V${m[1]} car engine`;
  if ((m = a.match(/^(\d+) cylindres/))) return `a ${m[1]}-cylinder car engine`;
  if (/^v\d+$/.test(a) || /^w\d+$/.test(a)) return `a ${arch.toUpperCase()} car engine`;
  if (/rotor/.test(a)) return `a Wankel rotary engine (${arch})`;
  return `a car engine (${arch})`;
}

const GEARBOX = {
  manuelle: "a manual car gearbox with its gear lever",
  sequentielle: "a sequential racing gearbox",
  double_embrayage: "a dual-clutch (DCT) transmission",
  robotisee: "an automated manual (robotised) transmission",
};
const TIRE = {
  route: "a road car tire with a standard tread pattern",
  sport: "a high-performance sport tire with a tread pattern",
  pluie: "a rain tire with deep water-evacuating grooves",
  semi_slick: "a semi-slick track tire with minimal tread",
  slick: "a racing slick tire with no tread, mounted on an alloy wheel",
};
const BONUS = {
  revision_express: "a quick engine service (spark plug and wrench)",
  vidange_boite: "a gearbox oil change (oil drop and gearbox)",
  revision_complete: "a full engine and gearbox service",
  huile_moteur_competition: "a competition engine oil bottle",
  huile_boite_competition: "a competition gearbox oil bottle",
  assistance_plateau: "a race-track service truck with a tow hook",
};

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const q = async (sql) => (await client.query(sql)).rows;

const archs = (await q("select distinct architecture a from card_templates where category='moteur' and is_active and architecture is not null order by 1")).map((r) => r.a);
const gearboxes = (await q("select unnest(enum_range(null::gearbox_type))::text v")).map((r) => r.v);
const tires = (await q("select unnest(enum_range(null::tire_type))::text v")).map((r) => r.v);
const bonuses = (await q("select unnest(enum_range(null::bonus_effect))::text v")).map((r) => r.v);
const engineCodes = (await q("select code from card_templates where category='moteur' and is_active and code is not null order by code")).map((r) => r.code);
await client.end();

const sections = [
  ["moteur", archs.map((a) => ({ file: `_${slug(a)}`, subject: engineSubject(a), label: a }))],
  ["boite", gearboxes.map((g) => ({ file: `_${slug(g)}`, subject: GEARBOX[g] ?? g, label: g }))],
  ["pneus", tires.map((t) => ({ file: `_${slug(t)}`, subject: TIRE[t] ?? t, label: t }))],
  ["bonus", bonuses.map((b) => ({ file: `_${slug(b)}`, subject: BONUS[b] ?? b, label: b }))],
];

let missingTotal = 0;
for (const [dir, items] of sections) {
  const present = have(dir);
  const missing = items.filter((i) => !present.has(i.file));
  console.log(`\n== public/cards/${dir}/  (${items.length - missing.length}/${items.length} génériques présents)`);
  for (const i of missing) {
    missingTotal++;
    const style = dir === "bonus" ? "Flat game item icon, bold shapes, dark background, orange accent, no text, square 1:1 image" : STYLE;
    console.log(`  manque  ${i.file}.webp  [${i.label}]`);
    console.log(`          prompt : ${style}. Subject: ${i.subject}.`);
  }
}

const presentEngines = have("moteur");
const noOwn = engineCodes.filter((c) => !presentEngines.has(c.toLowerCase()));
console.log(`\nMoteurs avec image propre : ${engineCodes.length - noOwn.length}/${engineCodes.length} (les autres utilisent l'image générique de leur architecture).`);
if (process.argv.includes("--all")) console.log("Sans image propre :", noOwn.join(", "));
console.log(missingTotal === 0 ? "\nBanque générique complète." : `\n${missingTotal} image(s) générique(s) à ajouter.`);
