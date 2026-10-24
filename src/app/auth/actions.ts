"use server";

import { redirect } from "next/navigation";
import { withAdmin } from "@/lib/db";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/session";
import type { ActionState } from "@/lib/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signIn(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const { rows } = await withAdmin((c) =>
    c.query<{ id: string; password_hash: string }>("select id, password_hash from users where lower(email) = lower($1)", [email]),
  );
  // Même message (et même coût de hachage) que l'e-mail existe ou non.
  const user = rows[0];
  const ok = await verifyPassword(password, user?.password_hash ?? "00:00");
  if (!user || !ok) return { ok: false, message: "Email ou mot de passe incorrect." };

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
    const err = e as { code?: string; constraint?: string };
    if (err.code === "23505") {
      return { ok: false, message: err.constraint?.includes("username") ? "Ce pseudo est déjà pris." : "Cet email est déjà utilisé." };
    }
    throw e;
  }

  await createSession(userId);
  redirect("/garage");
}

export async function signOut() {
  await destroySession();
  redirect("/auth/login");
}
