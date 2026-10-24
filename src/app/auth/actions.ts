"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { PoolClient } from "pg";
import { withAdmin } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/session";
import type { ActionState } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BLOCKED = "Trop de tentatives, réessayez plus tard.";
const SIGNUP_GENERIC = "Impossible de créer le compte avec ces informations.";

/** Première IP de x-forwarded-for, sinon "unknown" (pas de liste de proxies de confiance). */
async function clientIp(): Promise<string> {
  const fwd = (await headers()).get("x-forwarded-for");
  const ip = fwd?.split(",")[0]?.trim();
  return ip || "unknown";
}

async function countRecent(c: PoolClient, kind: string, key: string, window: string): Promise<number> {
  const { rows } = await c.query<{ n: number }>(
    `select count(*)::int as n from auth_attempts
      where kind = $1 and key = $2 and created_at > now() - $3::interval`,
    [kind, key, window],
  );
  return rows[0]?.n ?? 0;
}

/** 1 chance sur 50 : retire les tentatives de plus de 24 h. */
async function maybePurgeAttempts(c: PoolClient) {
  if (Math.random() < 1 / 50) {
    await c.query("delete from auth_attempts where created_at < now() - interval '24 hours'");
  }
}

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const ip = await clientIp();

  const allowed = await withAdmin(async (c) => {
    await maybePurgeAttempts(c);
    const ipCount = await countRecent(c, "login_ip", ip, "15 minutes");
    if (ipCount >= 20) return false;
    await c.query("insert into auth_attempts (kind, key) values ('login_ip', $1)", [ip]);
    const emailFails = await countRecent(c, "login_fail_email", email, "15 minutes");
    return emailFails < 5;
  });
  if (!allowed) return { ok: false, message: BLOCKED };

  const { rows } = await withAdmin((c) =>
    c.query<{ id: string; password_hash: string }>("select id, password_hash from users where lower(email) = lower($1)", [email]),
  );
  // Même message (et même coût de hachage) que l'e-mail existe ou non.
  const user = rows[0];
  const ok = await verifyPassword(password, user?.password_hash ?? "00:00");
  if (!user || !ok) {
    await withAdmin((c) => c.query("insert into auth_attempts (kind, key) values ('login_fail_email', $1)", [email]));
    return { ok: false, message: "Email ou mot de passe incorrect." };
  }

  await withAdmin((c) => c.query("delete from auth_attempts where kind = 'login_fail_email' and key = $1", [email]));
  await createSession(user.id);
  redirect("/garage");
}

export async function signUp(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const username = String(formData.get("username") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!/^[A-Za-z0-9_.-]{3,24}$/.test(username)) {
    return { ok: false, message: "Pseudo : 3 à 24 caractères (lettres, chiffres, _ . -)." };
  }
  if (!EMAIL_RE.test(email)) return { ok: false, message: "Email invalide." };
  if (password.length < 8) return { ok: false, message: "Mot de passe : 8 caractères minimum." };

  const ip = await clientIp();
  const allowed = await withAdmin(async (c) => {
    await maybePurgeAttempts(c);
    const n = await countRecent(c, "signup_ip", ip, "1 hour");
    if (n >= 5) return false;
    await c.query("insert into auth_attempts (kind, key) values ('signup_ip', $1)", [ip]);
    return true;
  });
  if (!allowed) return { ok: false, message: BLOCKED };

  const hash = await hashPassword(password);
  let userId: string;
  try {
    userId = await withAdmin(async (c) => {
      const { rows } = await c.query<{ id: string }>(
        "insert into users (email, password_hash) values ($1, $2) returning id", [email, hash]);
      await c.query("insert into profiles (id, username) values ($1, $2)", [rows[0].id, username]);
      if (process.env.STARTER_KIT === "1") await c.query("select private.grant_starter_kit($1)", [rows[0].id]);
      return rows[0].id;
    });
  } catch (e) {
    const err = e as { code?: string; constraint?: string; message?: string; stack?: string };
    if (err.code === "23505" && err.constraint?.includes("username")) {
      return { ok: false, message: "Ce pseudo est déjà pris." };
    }
    if (err.code !== "23505") console.error("[signUp]", err.message ?? "", err.code ?? "", err.stack ?? "");
    return { ok: false, message: SIGNUP_GENERIC };
  }

  await createSession(userId);
  redirect("/garage");
}

export async function signOut() {
  await destroySession();
  redirect("/auth/login");
}
