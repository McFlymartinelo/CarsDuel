import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { withUser } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  const endpoint = body?.endpoint?.trim();

  if (endpoint) {
    await withUser(user.id, (c) =>
      c.query("select public.delete_push_subscription($1::uuid, $2::text)", [user.id, endpoint]),
    );
  } else {
    await withUser(user.id, (c) =>
      c.query("select public.delete_all_push_subscriptions($1::uuid)", [user.id]),
    );
  }

  return NextResponse.json({ ok: true });
}
