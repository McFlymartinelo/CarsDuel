import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

/** Utilisateur authentifié (session valide en base) ou redirection vers le login. */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return { user };
}
