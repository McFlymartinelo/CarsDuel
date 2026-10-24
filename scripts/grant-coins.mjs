// Crédite des pièces à un joueur : node scripts/grant-coins.mjs <pseudo|email> <montant>
// Se connecte en propriétaire (DATABASE_URL) et passe par private.adjust_coins,
// donc le solde et le journal coin_transactions restent cohérents.
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

const who = process.argv[2];
const amountRaw = process.argv[3];
const amount = /^[1-9]\d*$/.test(amountRaw ?? "") ? Number(amountRaw) : NaN;

if (!who || !Number.isSafeInteger(amount) || amount > 2_147_483_647) {
  console.error("Usage : npm run coins:add -- <pseudo|email> <montant>");
  console.error("Exemple : npm run coins:add -- alex 500");
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL manquant (voir env.example → .env.local).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  await client.query("begin");
  const found = await client.query(
    `select p.id, p.username, p.coins, u.email
       from public.profiles p
       join public.users u on u.id = p.id
      where p.username = $1 or lower(u.email) = lower($1)
      for update of p`,
    [who],
  );
  if (found.rowCount === 0) throw new Error(`Aucun joueur pour « ${who} ».`);
  if (found.rowCount > 1) throw new Error(`Plusieurs joueurs correspondent à « ${who} ». Précise le pseudo ou l'e-mail.`);

  const user = found.rows[0];
  await client.query("select private.adjust_coins($1, $2, 'admin')", [user.id, amount]);
  const after = await client.query("select coins from public.profiles where id = $1", [user.id]);
  await client.query("commit");

  const coins = after.rows[0].coins;
  console.log(`${user.username} (${user.email}) : ${user.coins} → ${coins} pièces (+${amount}).`);
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
