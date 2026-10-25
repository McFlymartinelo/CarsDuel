import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

const logo = await readFile(join(root, "public", "logo.svg"));

await mkdir(outDir, { recursive: true });

const sizes = [
  ["icon-512.png", 512, 1],
  ["icon-192.png", 192, 1],
  ["icon-512-maskable.png", 512, 0.8],
  ["icon-192-maskable.png", 192, 0.8],
  ["apple-touch-icon.png", 180, 1],
  ["favicon-32.png", 32, 1],
];

for (const [name, size, scale] of sizes) {
  const contentSize = Math.round(size * scale);
  const content = await sharp(logo).resize(contentSize, contentSize, { fit: "contain" }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: "#0a0c10" } })
    .composite([{ input: content, gravity: "centre" }])
    .png()
    .toFile(join(outDir, name));
}

console.log("icons written to", outDir);
