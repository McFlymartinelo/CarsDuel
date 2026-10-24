import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

// Deux chevrons face à face, dans la zone sûre (masque Android + coins iOS).
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0c10"/>
  <path d="M118 158 L236 256 L118 354" fill="none" stroke="#fbbf24" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M394 158 L276 256 L394 354" fill="none" stroke="#f59e0b" stroke-width="42" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const master = sharp(Buffer.from(svg)).png();

await mkdir(outDir, { recursive: true });

const sizes = [
  ["icon-512.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
  ["favicon-32.png", 32],
];

for (const [name, size] of sizes) {
  await master.clone().resize(size, size).png().toFile(join(outDir, name));
}

console.log("icons written to", outDir);
