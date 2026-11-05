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

/** Catalogue moteurs et boîtes (db/catalog/*.json), puis prix de la boutique. Rejouable. */
async function loadParts() {
  const parts = ["moteurs", "boites"].flatMap((name) =>
    JSON.parse(fs.readFileSync(path.join(root, "db", "catalog", `${name}.json`), "utf8")));
  const codes = parts.map((p) => p.code);
  await client.query("begin");
  try {
    await client.query(fs.readFileSync(path.join(root, "db", "catalog", "upsert_parts.sql"), "utf8"), [JSON.stringify(parts)]);
    await client.query(fs.readFileSync(path.join(root, "db", "catalog", "retire_parts.sql"), "utf8"), [codes]);
    await client.query("commit");
  } catch (e) {
    await client.query("rollback");
    throw e;
  }
  await runFile(path.join(root, "db", "shop_prices.sql"));
  console.log(`Catalogue : ${parts.length} pièces.`);
}

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
    // Verrou de session : deux migrate concurrents s'exécutent l'un après l'autre.
    await client.query("select pg_advisory_lock(hashtext('carsduel_migrate')::bigint)");
    try {
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
    } finally {
      await client.query("select pg_advisory_unlock(hashtext('carsduel_migrate')::bigint)").catch(() => {});
    }
  } else if (cmd === "seed" || cmd === "dev-seed") {
    await runFile(path.join(root, "db", cmd === "seed" ? "seed.sql" : "dev_seed.sql"));
    if (cmd === "seed") await loadParts();
    console.log(cmd === "seed" ? "Seed appliqué." : "Seed de test appliqué.");
  } else if (cmd === "parts") {
    await loadParts();
  } else {
    console.error("Usage : node scripts/db.mjs <migrate|seed|dev-seed|parts>");
    process.exit(1);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
