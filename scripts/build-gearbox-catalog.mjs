// Construit db/catalog_gearboxes.sql depuis l'export Google Sheets des boîtes.
// Usage : node scripts/build-gearbox-catalog.mjs "C:\chemin\Carsduel_DATA - Boîtes de vitesses.csv"
import fs from "node:fs";
import path from "node:path";

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage : node scripts/build-gearbox-catalog.mjs <boites.csv>");
  process.exit(1);
}

const VENDOR = "Magasin de pièces neuves";

const TYPE = {
  manuelle: "manuelle",
  "auto (convertisseur)": "convertisseur",
  "robotisee (simple)": "robotisee",
  "variation continue": "variation_continue",
  "double embrayage": "double_embrayage",
  sequentielle: "sequentielle",
  "multi-embrayages": "multi_embrayages",
  "double embrayage / sequentielle": "dct_sequentielle",
};

const RARITY = {
  commune: "commune",
  rare: "rare",
  "tres rare": "tres_rare",
  epique: "epique",
  legendaire: "legendaire",
};

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

function fold(value) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/[\u200b\u200c\u200d\ufeff]/g, "").toLowerCase().trim();
}

function num(raw, label, code) {
  const n = Number(String(raw).replace(",", ".").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) throw new Error(`${code} : ${label} illisible (${raw})`);
  return n;
}

function column(header, pattern, label) {
  const index = header.findIndex((cell) => pattern.test(fold(cell)));
  if (index < 0) throw new Error(`Colonne manquante : ${label} (${header.join(" | ")})`);
  return index;
}

function sqlStr(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

/** B12 dans la feuille désigne b_12. */
function gearboxCode(sheetId) {
  let id = sheetId.trim();
  if (/^b/i.test(id)) id = id.slice(1);
  if (!id) throw new Error(`Identifiant vide (${sheetId})`);
  return `b_${id.toLowerCase()}`;
}

const rows = parseCSV(fs.readFileSync(csvPath, "utf8"));
const header = rows[0];
const iId = column(header, /^#$/, "#");
const iName = column(header, /nom en jeu/, "nom");
const iType = column(header, /^type$/, "type");
const iShift = column(header, /vitesse de passage/, "vitesse de passage");
const iWeight = column(header, /poids/, "poids");
const iVendor = column(header, /vendeur neuf/, "vendeur neuf");
const iPrice = column(header, /prix neuf/, "prix neuf");
const iRarity = column(header, /raret/, "rareté");
const iR0 = column(header, /^r0/, "R0");
const iWear = column(header, /\/run|^δr|^dr/, "ΔR");
const iRef = column(header, /reference/, "référence");

const boxes = [];
const seen = new Set();
for (const cells of rows.slice(1)) {
  const code = gearboxCode(cells[iId]);
  if (seen.has(code)) throw new Error(`code en double : ${code}`);
  seen.add(code);
  const name = cells[iName].trim();
  const reference = (cells[iRef] ?? "").trim();
  const gearboxType = TYPE[fold(cells[iType])];
  if (!gearboxType) throw new Error(`${code} : type inconnu (${cells[iType]})`);
  const rarity = RARITY[fold(cells[iRarity])];
  if (!rarity) throw new Error(`${code} : rareté inconnue (${cells[iRarity]})`);
  const shift = num(cells[iShift], "vitesse", code);
  const weight = num(cells[iWeight], "poids", code);
  const r0 = num(cells[iR0], "R0", code);
  const wear = num(cells[iWear], "ΔR", code);
  const soldRaw = fold(cells[iVendor]);
  if (soldRaw !== "oui" && soldRaw !== "non") throw new Error(`${code} : Vendeur Neuf invalide (${cells[iVendor]})`);
  const priceRaw = (cells[iPrice] ?? "").trim();
  let price = null;
  if (soldRaw === "oui") {
    if (!priceRaw) throw new Error(`${code} : vendue neuve sans prix`);
    price = num(priceRaw, "prix", code);
    if (!Number.isInteger(price) || price < 0) throw new Error(`${code} : prix neuf invalide (${priceRaw})`);
  } else if (priceRaw) {
    console.warn(`${code} : prix ${priceRaw} ignoré, Vendeur Neuf = Non`);
  }
  if (!Number.isInteger(shift) || shift < 0 || !(weight > 0) || r0 < 0 || r0 > 100 || wear < 0) {
    throw new Error(`${code} : valeurs hors contraintes`);
  }
  boxes.push({ code, name, reference, rarity, gearboxType, shift, weight, r0, wear, price });
}

const counts = new Map();
for (const b of boxes) counts.set(b.gearboxType, (counts.get(b.gearboxType) ?? 0) + 1);
console.log(`${boxes.length} boîtes, ${boxes.filter((b) => b.price != null).length} au magasin`);
for (const [type, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${type}`);

const values = boxes.map((b) =>
  `  (${sqlStr(b.code)}, 'boite', ${sqlStr(b.name)}, ${sqlStr(b.reference)}, ${sqlStr(b.rarity)}, ${sqlStr(b.gearboxType)}, ${b.shift}, ${b.weight}, ${b.r0}, ${b.wear})`,
).join(",\n");
const codeList = boxes.map((b) => sqlStr(b.code)).join(", ");
const sold = boxes.filter((b) => b.price != null);
const soldValues = sold.map((b) => `  (${sqlStr(b.code)}, ${b.price})`).join(",\n");
const soldList = sold.map((b) => sqlStr(b.code)).join(", ");

const sql = `-- Catalogue boîtes (export Google Sheets). Régénéré par scripts/build-gearbox-catalog.mjs.
-- La référence réelle est stockée dans description.
-- Vendeur Neuf = Oui alimente le magasin de pièces neuves au prix indiqué. Stock NULL = illimité.
-- Toute boîte absente de cet export est désactivée (y compris les 6 boîtes du seed de test).
insert into public.card_templates
  (code, category, name, description, rarity, gearbox_type, shift_time_ms, weight_kg, base_break_risk, wear_sensitivity)
values
${values}
on conflict (code) do update set
  category = excluded.category,
  name = excluded.name,
  description = excluded.description,
  rarity = excluded.rarity,
  gearbox_type = excluded.gearbox_type,
  shift_time_ms = excluded.shift_time_ms,
  weight_kg = excluded.weight_kg,
  base_break_risk = excluded.base_break_risk,
  wear_sensitivity = excluded.wear_sensitivity,
  is_active = true;

update public.card_templates
set is_active = false
where category = 'boite'
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
  and t.category = 'boite'
  and t.code not in (${soldList});
`;

const out = path.resolve(import.meta.dirname, "..", "db", "catalog_gearboxes.sql");
fs.writeFileSync(out, sql);
console.log("écrit :", out);
