import { NextResponse } from "next/server";
import { getVapidConfig } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Clé publique VAPID : nécessaire avant de créer un abonnement côté navigateur. */
export function GET() {
  const config = getVapidConfig();
  return NextResponse.json(
    { configured: Boolean(config), publicKey: config?.publicKey ?? null },
    { headers: { "cache-control": "no-store" } },
  );
}
