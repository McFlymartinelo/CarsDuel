// Liste les comptes joueurs : pseudo, e-mail (identifiant de connexion) et activité.
// node scripts/list-users.mjs [recherche]
// Lecture seule, en propriétaire (DATABASE_URL). Les mots de passe (scrypt salé)
// ne sont jamais affichés : ils ne sont pas récupérables en clair.
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

const search = process.argv[2]?.trim() || null;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

try {
  const { rows } = await client.query(
    `select p.username,
            u.email,
            p.coins,
            p.xp_total,
            u.created_at as registered_at,
            s.last_login,
            coalesce(s.active_sessions, 0) as active_sessions
       from public.users u
       join public.profiles p on p.id = u.id
       left join lateral (
         select max(created_at) as last_login,
                count(*) filter (where expires_at > now()) as active_sessions
           from public.sessions
          where user_id = u.id
       ) s on true
      where $1::text is null
         or p.username ilike '%' || $1 || '%'
         or u.email ilike '%' || $1 || '%'
      order by lower(p.username)`,
    [search],
  );

  if (rows.length === 0) {
    console.log(search ? `Aucun compte pour « ${search} ».` : "Aucun compte.");
  } else {
    const dateFmt = new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Europe/Paris",
    });
    const fmtDate = (d) => (d ? dateFmt.format(new Date(d)) : "—");

    const table = rows.map((r) => ({
      Pseudo: r.username,
      Email: r.email,
      Pièces: r.coins,
      XP: r.xp_total,
      "Inscrit le": fmtDate(r.registered_at),
      "Dernière connexion": fmtDate(r.last_login),
      Sessions: r.active_sessions,
    }));

    // Largeurs calculées sur le contenu (en caractères).
    const cols = Object.keys(table[0]);
    const widths = cols.map((c) =>
      Math.max(c.length, ...table.map((row) => String(row[c]).length)),
    );
    const line = (cells) =>
      cells.map((cell, i) => String(cell).padEnd(widths[i])).join("  ").trimEnd();

    console.log(line(cols));
    console.log(widths.map((w) => "─".repeat(w)).join("  "));
    for (const row of table) console.log(line(cols.map((c) => row[c])));
    console.log(`\n${rows.length} compte(s)${search ? ` pour « ${search} »` : ""}.`);
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
