// Réinitialise le mot de passe d'un joueur (admin) :
//   node scripts/set-password.mjs <pseudo|email> <nouveau_mdp>
//   node scripts/set-password.mjs <pseudo|email> -   (mot de passe lu sur stdin)
// Même format que src/lib/session.ts (scrypt, sel aléatoire, clé de 64 octets).
// Toutes les sessions du joueur sont invalidées. Le mot de passe n'est jamais affiché.
import fs from "node:fs";
import path from "node:path";
import { randomBytes, scrypt } from "node:crypto";
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

const scryptAsync = (pw, salt) =>
  new Promise((resolve, reject) => scrypt(pw, salt, 64, (e, k) => (e ? reject(e) : resolve(k))));

async function hashPassword(password) {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${(await scryptAsync(password, salt)).toString("hex")}`;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8").replace(/\r?\n$/, "");
}

const who = process.argv[2];
const passwordArg = process.argv[3];

if (!who || !passwordArg) {
  console.error("Usage : npm run users:set-password -- <pseudo|email> <nouveau_mdp>");
  console.error("        npm run users:set-password -- <pseudo|email> -   (mdp sur stdin)");
  console.error("Exemple : npm run users:set-password -- alex 'NouveauMotDePasse!'");
  process.exit(1);
}

const password = passwordArg === "-" ? await readStdin() : passwordArg;
if (password.length < 8) {
  console.error("Mot de passe trop court : 8 caractères minimum.");
  process.exit(1);
}
if (password.length > 200) {
  console.error("Mot de passe trop long : 200 caractères maximum.");
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
    `select p.id, p.username, u.email
       from public.profiles p
       join public.users u on u.id = p.id
      where p.username = $1 or lower(u.email) = lower($1)
      for update of u`,
    [who],
  );
  if (found.rowCount === 0) throw new Error(`Aucun joueur pour « ${who} ».`);
  if (found.rowCount > 1) throw new Error(`Plusieurs joueurs correspondent à « ${who} ». Précise le pseudo ou l'e-mail.`);

  const user = found.rows[0];
  const hash = await hashPassword(password);
  await client.query("update public.users set password_hash = $1 where id = $2", [hash, user.id]);
  const killed = await client.query("delete from public.sessions where user_id = $1", [user.id]);
  await client.query("commit");

  console.log(
    `Mot de passe réinitialisé pour ${user.username} (${user.email}). ` +
      `Sessions invalidées : ${killed.rowCount}.`,
  );
} catch (e) {
  await client.query("rollback").catch(() => {});
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
