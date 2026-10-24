// Outil SQL minimal : node scripts/db.mjs <migrate|seed|dev-seed>
// Lit DATABASE_URL depuis l'environnement ou .env.local. Aucune dépendance hors `pg`.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const root = path.resolve(import.meta.dirname, "..");

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

const cmd = process.argv[2];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function runFile(file) {
  await client.query("begin");
  try {
    await client.query(fs.readFileSync(file, "utf8"));
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
}

try {
  if (cmd === "migrate") {
    await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
    const dir = path.join(root, "db", "migrations");
    const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      if (done.has(f)) continue;
      await client.query("begin");
      try {
        await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
        await client.query("insert into schema_migrations (name) values ($1)", [f]);
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw new Error(`${f}: ${e.message}`);
      }
      console.log("appliquée :", f);
    }
    console.log("Migrations à jour.");
  } else if (cmd === "seed" || cmd === "dev-seed") {
    await runFile(path.join(root, "db", cmd === "seed" ? "seed.sql" : "dev_seed.sql"));
    if (cmd === "seed") {
      await runFile(path.join(root, "db", "catalog_engines.sql"));
      await runFile(path.join(root, "db", "catalog_gearboxes.sql"));
    }
    console.log(cmd === "seed" ? "Seed appliqué." : "Seed de test appliqué.");
  } else {
    console.error("Usage : node scripts/db.mjs <migrate|seed|dev-seed>");
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
