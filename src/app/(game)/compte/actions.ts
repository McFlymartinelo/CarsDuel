"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withAdmin } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";
import { invalidateOtherSessions } from "@/lib/session";
import { normalizeEmail, validateEmail, validatePassword, validateUsername } from "@/lib/validation";
import type { ActionState } from "@/lib/types";

function unique(e: unknown, needle: string) {
  const err = e as { code?: string; constraint?: string };
  return err.code === "23505" && (err.constraint?.includes(needle) ?? false);
}

async function passwordHash(userId: string) {
  const { rows } = await withAdmin((c) =>
    c.query<{ password_hash: string }>("select password_hash from users where id = $1", [userId]),
  );
  return rows[0]?.password_hash;
}

export async function updateUsername(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const username = String(formData.get("username") ?? "").trim();
  const usernameError = validateUsername(username);
  if (usernameError) return { ok: false, message: usernameError };
  if (username === user.username) return { ok: true, message: "Pseudo inchangé." };

  try {
    await withAdmin((c) => c.query("update profiles set username = $1 where id = $2", [username, user.id]));
  } catch (e) {
    if (unique(e, "username")) return { ok: false, message: "Ce pseudo est déjà pris." };
    console.error("[updateUsername]", e);
    return { ok: false, message: "Impossible de modifier le pseudo." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Pseudo mis à jour." };
}

export async function updateEmail(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const email = normalizeEmail(formData.get("email"));
  const current = String(formData.get("current_password") ?? "");
  const emailError = validateEmail(email);
  if (emailError) return { ok: false, message: emailError };

  const stored = await passwordHash(user.id);
  if (!stored || !(await verifyPassword(current, stored))) {
    return { ok: false, message: "Mot de passe actuel incorrect." };
  }
  if (email === user.email.toLowerCase()) return { ok: true, message: "E-mail inchangé." };

  try {
    await withAdmin((c) => c.query("update users set email = $1 where id = $2", [email, user.id]));
  } catch (e) {
    if (unique(e, "email")) return { ok: false, message: "Cet e-mail est déjà utilisé." };
    console.error("[updateEmail]", e);
    return { ok: false, message: "Impossible de modifier l'e-mail." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "E-mail mis à jour." };
}

export async function updatePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("password") ?? "");
  const again = String(formData.get("password_confirm") ?? "");
  const passwordError = validatePassword(next);
  if (passwordError) return { ok: false, message: passwordError };
  if (next !== again) return { ok: false, message: "Les deux mots de passe ne correspondent pas." };

  const stored = await passwordHash(user.id);
  if (!stored || !(await verifyPassword(current, stored))) {
    return { ok: false, message: "Mot de passe actuel incorrect." };
  }

  const hash = await hashPassword(next);
  await withAdmin((c) => c.query("update users set password_hash = $1 where id = $2", [hash, user.id]));
  await invalidateOtherSessions(user.id);
  return { ok: true, message: "Mot de passe mis à jour." };
}
