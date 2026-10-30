// Construit db/catalog_engines.sql depuis l'export Google Sheets des moteurs.
// Usage : node scripts/build-engine-catalog.mjs "C:\chemin\Carsduel_DATA - Moteurs.csv"
import fs from "node:fs";
import path from "node:path";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage : node scripts/build-engine-catalog.mjs <moteurs.csv>");
  process.exit(1);
}

const VENDOR = "Magasin de pièces neuves";

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let quoted = false;
  const src = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cur += '"'; i++; }
        else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else if (c !== "\r") cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function num(raw, label, code) {
  const n = Number(String(raw).replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${code} : ${label} illisible (${raw})`);
  return n;
}

function normHeader(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[\u200b\u200c\u200d\ufeff]/g, "").toLowerCase().trim();
}

function column(header, pattern, label) {
  const index = header.findIndex((cell) => pattern.test(normHeader(cell)));
  if (index < 0) throw new Error(`Colonne manquante : ${label} (${header.join(" | ")})`);
  return index;
}

const RARITY = {
  commune: "commune",
  rare: "rare",
  "très rare": "tres_rare",
  "tres rare": "tres_rare",
  epique: "epique",
  épique: "epique",
  légendaire: "legendaire",
  legendaire: "legendaire",
};

/** La feuille n'a pas de colonne architecture. On la déduit du nom, puis de la référence. */
function architecture(name, ref) {
  const blob = `${name} ${ref}`;
  if (/W16|Quadri-Turbo/i.test(name)) return "W16";
  if (/Quatre-Rotors/i.test(name)) return "4 rotors";
  if (/Bi-Rotor/i.test(name)) return "bi-rotor";
  if (/à Plat|a Plat/i.test(name)) return "6 cylindres à plat";
  if (/Boxer/i.test(name)) return "4 cylindres à plat";
  if (/Écartement Réduit|Ecartement Réduit/i.test(name)) return "6 cylindres en V";
  if (/Six-Cylindres|Six-en-Ligne/i.test(name)) return "6 cylindres en ligne";
  if (/Cinq-Cylindres/i.test(name)) return "5 cylindres";
  if (/Quatre-Cylindres/i.test(name)) return "4 cylindres";
  if (/\bV12\b/i.test(name)) return "V12";
  if (/\bV10\b/i.test(name)) return "V10";
  if (/\bV8\b/i.test(name)) return "V8";
  if (/\bV6\b/i.test(name)) return "V6";
  if (/3-Cylindres/i.test(name)) return "3 cylindres";
  if (/Bicylindre/i.test(name)) return "2 cylindres";
  // 1.2 PureTech (EB2) est un 3 cylindres. Le 1.6 PureTech reste un 4 cylindres.
  if (/1\.2 PureTech|\bEB2\b/i.test(blob)) return "3 cylindres";
  if (/^1\.0\b/.test(name)) return "3 cylindres";
  return "4 cylindres";
}

function sqlStr(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** M1a dans la feuille et 1a dans l'ancien export désignent le même moteur : M1A. */
function engineCode(sheetId) {
  let id = sheetId.trim();
  if (/^m/i.test(id)) id = id.slice(1);
  if (!id) throw new Error(`Identifiant vide (${sheetId})`);
  return `M${id.replaceAll("_", "").toUpperCase()}`;
}

function loadPrevious(file) {
  if (!fs.existsSync(file)) return new Map();
  const text = fs.readFileSync(file, "utf8");
  const map = new Map();
  const re = /\('((?:[^']|'')*)',\s*'moteur',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)',\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?),\s*(\d+(?:\.\d+)?)\)/g;
  const un = (s) => s.replaceAll("''", "'");
  for (const match of text.matchAll(re)) {
    map.set(un(match[1]), {
      name: un(match[2]),
      reference: un(match[3]),
      rarity: un(match[4]),
      arch: un(match[5]),
      power: Number(match[6]),
      weight: Number(match[7]),
      r0: Number(match[8]),
      wear: Number(match[9]),
    });
  }
  return map;
}

const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
const header = rows[0];
const iId = column(header, /^#$/, "#");
const iName = column(header, /nom en jeu/, "nom");
const iPower = column(header, /puissance/, "puissance");
const iWeight = column(header, /poids/, "poids");
const iR0 = column(header, /^r0/, "R0");
const iWear = column(header, /\/run|^δr|^dr/, "ΔR");
const iVendor = column(header, /vendeur neuf/, "vendeur neuf");
const iPrice = column(header, /prix neuf/, "prix neuf");
const iRarity = column(header, /raret/, "rareté");
const iRef = column(header, /reference/, "référence");

const engines = [];
const seen = new Set();
for (const cells of rows.slice(1)) {
  const code = engineCode(cells[iId]);
  if (seen.has(code)) throw new Error(`code en double : ${code}`);
  seen.add(code);
  const name = cells[iName].trim();
  const reference = (cells[iRef] ?? "").trim();
  const rarity = RARITY[cells[iRarity].trim().toLowerCase()];
  if (!rarity) throw new Error(`${code} : rareté inconnue (${cells[iRarity]})`);
  const power = num(cells[iPower], "puissance", code);
  const weight = num(cells[iWeight], "poids", code);
  const r0 = num(cells[iR0], "R0", code);
  const wear = num(cells[iWear], "ΔR", code);
  const arch = architecture(name, reference);
  const soldRaw = cells[iVendor].trim().toLowerCase();
  if (soldRaw !== "oui" && soldRaw !== "non") throw new Error(`${code} : Vendeur Neuf invalide (${cells[iVendor]})`);
  const priceRaw = (cells[iPrice] ?? "").trim();
  let price = null;
  if (soldRaw === "oui") {
    if (!priceRaw) throw new Error(`${code} : vendu neuf sans prix`);
    price = num(priceRaw, "prix", code);
    if (!Number.isInteger(price) || price < 0) throw new Error(`${code} : prix neuf invalide (${priceRaw})`);
  } else if (priceRaw) {
    console.warn(`${code} : prix ${priceRaw} ignoré, Vendeur Neuf = Non`);
  }
  if (!(power > 0) || !(weight > 0) || r0 < 0 || r0 > 100 || wear < 0 || !arch) {
    throw new Error(`${code} : valeurs hors contraintes`);
  }
  const suspicious = arch === "4 cylindres" && /(?:^|[^A-Za-z0-9])(?:V6|V8|V10|V12|W16)\b|Flat|Boxer|rotor|bicyl|cinq|six|3-cyl|triple/i.test(`${name} ${reference}`);
  engines.push({ code, name, reference, rarity, power, weight, r0, wear, arch, price, suspicious });
}

const counts = new Map();
for (const e of engines) counts.set(e.arch, (counts.get(e.arch) ?? 0) + 1);
console.log(`${engines.length} moteurs, ${engines.filter((e) => e.price != null).length} au magasin`);
for (const [arch, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${arch}`);
const bad = engines.filter((e) => e.suspicious);
if (bad.length) {
  console.log("À vérifier :");
  for (const e of bad) console.log(`  ${e.code} ${e.name} | ${e.reference}`);
}

function loadPreviousPrices(file) {
  if (!fs.existsSync(file)) return new Map();
  const text = fs.readFileSync(file, "utf8");
  const map = new Map();
  for (const match of text.matchAll(/\('([MB][^']*)',\s*(\d+)\)/g)) map.set(match[1], Number(match[2]));
  return map;
}

const out = path.resolve(import.meta.dirname, "..", "db", "catalog_engines.sql");
const previous = loadPrevious(out);
const previousPrices = loadPreviousPrices(out);
const changed = [];
const fieldCounts = new Map();
for (const e of engines) {
  const old = previous.get(e.code);
  if (!old) {
    changed.push(`${e.code} ajouté`);
    continue;
  }
  const fields = [];
  if (old.name !== e.name) fields.push("nom");
  if (old.reference !== e.reference) fields.push("référence");
  if (old.rarity !== e.rarity) fields.push("rareté");
  if (old.arch !== e.arch) fields.push("architecture");
  if (old.power !== e.power) fields.push("puissance");
  if (old.weight !== e.weight) fields.push("poids");
  if (old.r0 !== e.r0) fields.push("R0");
  if (old.wear !== e.wear) fields.push("ΔR");
  if (fields.length) {
    changed.push(`${e.code} : ${fields.join(", ")}`);
    for (const field of fields) fieldCounts.set(field, (fieldCounts.get(field) ?? 0) + 1);
  }
}
for (const code of previous.keys()) {
  if (!seen.has(code)) changed.push(`${code} retiré`);
}
const priceChanges = [];
for (const e of engines) {
  const before = previousPrices.get(e.code) ?? null;
  if (before !== e.price) priceChanges.push(`${e.code} : ${before ?? "hors boutique"} → ${e.price ?? "hors boutique"}`);
}
for (const [code, price] of previousPrices) {
  if (!seen.has(code)) priceChanges.push(`${code} : ${price} → retiré`);
}
if (previous.size) {
  console.log(changed.length ? `Écarts fiche / catalogue actuel (${changed.length}) :` : "Aucune fiche moteur modifiée hors boutique.");
  for (const [field, n] of fieldCounts) console.log(`  ${n} × ${field}`);
  for (const line of changed) {
    if (!line.endsWith("ΔR")) console.log(`  ${line}`);
  }
  console.log(priceChanges.length ? `Prix neuf modifiés (${priceChanges.length}) :` : "Prix neuf inchangés.");
  for (const line of priceChanges) console.log(`  ${line}`);
}

const values = engines.map((e) =>
  `  (${sqlStr(e.code)}, 'moteur', ${sqlStr(e.name)}, ${sqlStr(e.reference)}, ${sqlStr(e.rarity)}, ${sqlStr(e.arch)}, ${e.power}, ${e.weight}, ${e.r0}, ${e.wear})`,
).join(",\n");

const codeList = engines.map((e) => sqlStr(e.code)).join(", ");
const sold = engines.filter((e) => e.price != null);
const soldValues = sold.map((e) => `  (${sqlStr(e.code)}, ${e.price})`).join(",\n");
const soldList = sold.map((e) => sqlStr(e.code)).join(", ");

const sql = `-- Catalogue moteurs (export Google Sheets). Régénéré par scripts/build-engine-catalog.mjs.
-- architecture est absente de la feuille : déduite du nom, sinon de la référence.
-- La référence réelle est stockée dans description.
-- Vendeur Neuf = Oui alimente le magasin de pièces neuves au prix indiqué. Stock NULL = illimité.
-- Tout moteur absent de cet export est désactivé (y compris les 6 moteurs du seed de test).
insert into public.card_templates
  (code, category, name, description, rarity, architecture, power_hp, weight_kg, base_break_risk, wear_sensitivity)
values
${values}
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  architecture = excluded.architecture,
  power_hp = excluded.power_hp,
  weight_kg = excluded.weight_kg,
  base_break_risk = excluded.base_break_risk,
  wear_sensitivity = excluded.wear_sensitivity,
  is_active = true;

update public.card_templates
set is_active = false
where category = 'moteur'
  and restricted_to_username is null
  and code not in (${codeList});

insert into public.shop_catalog (vendor_id, template_id, price, is_active)
select v.id, t.id, x.price, true
from (values
${soldValues}
) as x(code, price)
join public.card_templates t on t.code = x.code
join public.shop_vendors v on v.name = ${sqlStr(VENDOR)}
on conflict (vendor_id, template_id) do update set
  price = excluded.price,
  is_active = true;

update public.shop_catalog sc
set is_active = false
from public.card_templates t
where sc.template_id = t.id
  and t.category = 'moteur'
  and t.restricted_to_username is null
  and t.code not in (${soldList});
`;

fs.writeFileSync(out, sql);
console.log("écrit :", out);
