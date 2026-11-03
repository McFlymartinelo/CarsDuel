import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { dispatchPushOutbox } from "@/lib/push-dispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.PUSH_DISPATCH_SECRET?.trim();
  if (!expected) return false;

  const header = request.headers.get("authorization") ?? "";
  const provided = header.replace(/^Bearer\s+/i, "").trim() || request.headers.get("x-push-secret")?.trim() || "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Drain manuel de l'outbox, pour un cron externe :
 *   curl -X POST -H "Authorization: Bearer $PUSH_DISPATCH_SECRET" https://…/api/push/dispatch
 * Le worker intégré (démarré au premier rendu authentifié) suffit si le serveur reste allumé.
 */
export async function POST(request: Request) {
  if (!process.env.PUSH_DISPATCH_SECRET?.trim()) {
    return NextResponse.json({ error: "PUSH_DISPATCH_SECRET n'est pas configuré." }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const result = await dispatchPushOutbox({ limit: 200 });
  return NextResponse.json(result);
}
