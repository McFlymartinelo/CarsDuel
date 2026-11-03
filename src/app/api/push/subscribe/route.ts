import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/session";
import { withUser } from "@/lib/db";
import { isAllowedPushEndpoint } from "@/lib/push-endpoint";
import { sendPushToUser } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SubscriptionBody {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
  quiet?: boolean;
}

function validate(body: SubscriptionBody | null) {
  const endpoint = body?.endpoint?.trim();
  const p256dh = body?.keys?.p256dh?.trim();
  const auth = body?.keys?.auth?.trim();
  if (!endpoint || !p256dh || !auth) return null;
  if (endpoint.length > 4096 || p256dh.length > 512 || auth.length > 512) return null;
  if (!isAllowedPushEndpoint(endpoint)) return null;

  return { endpoint, p256dh, auth };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Session expirée." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as SubscriptionBody | null;
  const subscription = validate(body);
  if (!subscription) {
    return NextResponse.json({ error: "Abonnement push invalide." }, { status: 400 });
  }

  await withUser(user.id, (c) =>
    c.query("select public.upsert_push_subscription($1::uuid, $2::text, $3::text, $4::text, $5::text)", [
      user.id,
      subscription.endpoint,
      subscription.p256dh,
      subscription.auth,
      request.headers.get("user-agent")?.slice(0, 300) ?? null,
    ]),
  );

  if (body?.quiet !== true) {
    // Confirmation immédiate : l'utilisateur voit que le canal fonctionne.
    const result = await sendPushToUser(user.id, {
      title: "Notifications activées",
      body: "Vous recevrez les offres, ventes, duels et primes même quand CarsDuel est fermé.",
      url: "/compte#notifications",
      tag: "carsduel-welcome",
      kind: "welcome",
    }).catch(() => null);

    return NextResponse.json({ ok: true, test: result });
  }

  return NextResponse.json({ ok: true });
}
