import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { rpcErrorMessage } from "@/lib/errors";
import { parseFormInt } from "@/lib/form-int";
import type { ActionState } from "@/lib/types";

/**
 * Invalide les pages listées.
 * Sans liste : layout entier, pour les pièces / XP du Nav.
 * "/" dans la liste a le même rôle : à passer seulement si l'action change pièces ou XP.
 */
export function invalidate(paths?: string[]) {
  if (!paths || paths.length === 0) {
    revalidatePath("/", "layout");
    return;
  }
  for (const p of paths) {
    if (p === "/") revalidatePath("/", "layout");
    else revalidatePath(p);
  }
}

/**
 * Exécute une requête (typiquement `select public.ma_rpc($1::uuid, ...) as r`) au nom du joueur connecté.
 * L'identifiant passé aux fonctions SQL est TOUJOURS celui de la session, jamais celui du formulaire ;
 * la base revérifie de toute façon current_uid() = paramètre.
 */
export async function callRpc<T = unknown>(
  sql: string,
  args: (userId: string) => unknown[],
  paths?: string[],
): Promise<ActionState<T>> {
  const { user } = await requireUser();
  try {
    const { rows } = await withUser(user.id, (c) => c.query(sql, args(user.id)));
    invalidate(paths);
    return { ok: true, data: rows[0]?.r as T };
  } catch (e) {
    return { ok: false, message: rpcErrorMessage(e) };
  }
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const optStr = (fd: FormData, key: string) => str(fd, key) || null;
export const int = (fd: FormData, key: string, errorCode?: string) => parseFormInt(str(fd, key), errorCode);
