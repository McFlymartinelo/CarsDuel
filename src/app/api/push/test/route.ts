import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const result = await sendPushToUser(user.id, {
    title: "CarsDuel — test",
    body: "Les notifications hors app fonctionnent. À bientôt sur la piste !",
    url: "/garage",
    tag: `carsduel-test-${Date.now()}`,
    kind: "test",
  });

  return NextResponse.json(result);
}
