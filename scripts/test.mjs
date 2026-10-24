// Prépare une base jetable carsduel_test, applique migrations + seed, lance node:test.
// Refus de s'exécuter si DATABASE_URL ne permet pas de créer une autre base.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");
const dbName = "carsduel_test";

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnvFile(path.join(root, ".env.local"));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL manquant (voir env.example → .env.local).");
  process.exit(1);
}

const source = new URL(process.env.DATABASE_URL);
const testUrl = new URL(source.href);
testUrl.pathname = `/${dbName}`;

function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env: { ...process.env, DATABASE_URL: testUrl.href },
      stdio: "inherit",
    });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${args.join(" ")} → code ${code}`))));
  });
}

async function maintenance() {
  const maint = new URL(source.href);
  maint.pathname = "/postgres";
  const client = new pg.Client({ connectionString: maint.href });
  try {
    await client.connect();
    return client;
  } catch {
    const fallback = new pg.Client({ connectionString: source.href });
    await fallback.connect();
    return fallback;
  }
}

const admin = await maintenance();
try {
  await admin.query(`drop database if exists ${dbName} with (force)`);
  await admin.query(`create database ${dbName}`);
} finally {
  await admin.end();
}

let failed = false;
try {
  await run(["scripts/db.mjs", "migrate"]);
  await run(["scripts/db.mjs", "seed"]);
  const files = fs.readdirSync(path.join(root, "tests", "db"))
    .filter((f) => f.endsWith(".test.mjs"))
    .map((f) => path.join("tests", "db", f));
  await run(["--test", "--test-concurrency=1", ...files]);
} catch (e) {
  failed = true;
  console.error(e.message);
} finally {
  const cleanup = await maintenance();
  try {
    await cleanup.query(`drop database if exists ${dbName} with (force)`);
  } finally {
    await cleanup.end();
  }
}

if (failed) process.exit(1);
