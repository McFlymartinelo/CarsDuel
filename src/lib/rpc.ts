import "server-only";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withUser } from "@/lib/db";
import { rpcErrorMessage } from "@/lib/errors";
import type { ActionState } from "@/lib/types";

/**
 * Exécute une requête (typiquement `select public.ma_rpc($1::uuid, ...) as r`) au nom du joueur connecté.
 * L'identifiant passé aux fonctions SQL est TOUJOURS celui de la session, jamais celui du formulaire ;
 * la base revérifie de toute façon current_uid() = paramètre.
 */
export async function callRpc<T = unknown>(
  sql: string,
  args: (userId: string) => unknown[],
): Promise<ActionState<T>> {
  const { user } = await requireUser();
  try {
    const { rows } = await withUser(user.id, (c) => c.query(sql, args(user.id)));
    revalidatePath("/", "layout");
    return { ok: true, data: rows[0]?.r as T };
  } catch (e) {
    return { ok: false, message: rpcErrorMessage(e as { message: string }) };
  }
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const optStr = (fd: FormData, key: string) => str(fd, key) || null;
export const int = (fd: FormData, key: string) => {
  const v = str(fd, key);
  return v === "" ? null : Number.parseInt(v, 10);
};
