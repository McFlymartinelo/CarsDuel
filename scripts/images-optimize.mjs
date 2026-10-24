// Compresse la banque d'images : tout passe en WebP (max 800 px, qualité 82).
//   npm run images:optimize            → simulation (ne modifie rien, affiche le gain)
//   npm run images:optimize -- --apply → convertit ; les originaux sont COPIÉS dans assets-src/cards/ (non servi)
//                                         avant d'être remplacés. Rien n'est perdu.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "..");
const cards = path.join(root, "public", "cards");
const backup = path.join(root, "assets-src", "cards");
const apply = process.argv.includes("--apply");
const MAX = 800;
const RASTER = new Set([".webp", ".png", ".jpg", ".jpeg", ".avif"]);
// Si plusieurs fichiers portent le même nom, on garde la source de meilleure qualité d'abord.
const PREFERENCE = [".png", ".jpg", ".jpeg", ".avif", ".webp"];

const kb = (n) => `${(n / 1024).toFixed(0)} Ko`;
let before = 0;
let after = 0;

for (const dir of fs.readdirSync(cards, { withFileTypes: true }).filter((d) => d.isDirectory())) {
  const folder = path.join(cards, dir.name);
  const groups = new Map();
  for (const f of fs.readdirSync(folder)) {
    const ext = path.extname(f).toLowerCase();
    if (!RASTER.has(ext)) continue; // .svg et .gitkeep ignorés
    const key = path.basename(f, path.extname(f));
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  for (const [key, files] of groups) {
    files.sort((a, b) => PREFERENCE.indexOf(path.extname(a).toLowerCase()) - PREFERENCE.indexOf(path.extname(b).toLowerCase()));
    const source = path.join(folder, files[0]);
    const input = fs.readFileSync(source);
    const out = await sharp(input).rotate().resize({ width: MAX, height: MAX, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();

    const originalsSize = files.reduce((s, f) => s + fs.statSync(path.join(folder, f)).size, 0);
    before += originalsSize;
    after += out.length;
    console.log(`${dir.name}/${key}: ${files.join(" + ")} (${kb(originalsSize)}) → ${key}.webp (${kb(out.length)})`);

    if (apply) {
      const saveTo = path.join(backup, dir.name);
      fs.mkdirSync(saveTo, { recursive: true });
      for (const f of files) fs.copyFileSync(path.join(folder, f), path.join(saveTo, f));
      fs.writeFileSync(path.join(folder, `${key}.webp`), out);
      for (const f of files) if (f !== `${key}.webp`) fs.rmSync(path.join(folder, f));
    }
  }
}

console.log(`\nTotal : ${(before / 1048576).toFixed(1)} Mo → ${(after / 1048576).toFixed(1)} Mo`);
console.log(apply ? "Fait. Originaux sauvegardés dans assets-src/cards/." : "Simulation seulement : relancez avec -- --apply pour convertir.");
