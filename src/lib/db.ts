import { Pool, types, type PoolClient } from "pg";

// pg renvoie numeric/int8/date/timestamptz en chaînes ou Date : on normalise pour l'UI.
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric
types.setTypeParser(20, (v) => parseInt(v, 10)); // int8 (bigint, count, rank)
types.setTypeParser(1082, (v) => v); // date → "YYYY-MM-DD"
// timestamptz → ISO 8601 ("2026-10-24 00:23:21.925+02" → "2026-10-23T22:23:21.925Z")
types.setTypeParser(1184, (v) => new Date(v.replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00")).toISOString());

const g = globalThis as unknown as { __pgPool?: Pool };
export const pool = (g.__pgPool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.DB_POOL_MAX ?? 10) }));

async function tx<T>(setup: (c: PoolClient) => Promise<void>, fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await setup(c);
    const result = await fn(c);
    await c.query("COMMIT");
    return result;
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

/**
 * Transaction « au nom d'un joueur » : rôle app_user (RLS appliquée) + app.user_id posé,
 * ce qui permet aux RPC SQL de vérifier l'identité de l'appelant.
 */
export const withUser = <T>(userId: string, fn: (c: PoolClient) => Promise<T>) =>
  tx(async (c) => {
    await c.query("SET LOCAL ROLE app_user");
    await c.query("SELECT set_config('app.user_id', $1, true)", [userId]);
  }, fn);

/** Transaction avec les droits du propriétaire : réservée à l'authentification (users, sessions, inscription). */
export const withAdmin = <T>(fn: (c: PoolClient) => Promise<T>) => tx(async () => {}, fn);
