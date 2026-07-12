import { NextResponse } from "next/server";
import { getPushDb } from "@/lib/push-db";
import { sendPushNotification, type PushSubscriptionJSON } from "@/lib/push";

export const runtime = "nodejs";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PantryDoc = {
  userId?: string | null;
  name?: string;
  expiresAt?: Date | string;
};

type SubDoc = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  expirationTime?: number | null;
  userId?: string | null;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.MONGODB_URI) {
    return NextResponse.json({ error: "MONGODB_URI is not set" }, { status: 503 });
  }

  try {
    const db = await getPushDb();
    const now = startOfDay(new Date());
    const until = new Date(now.getTime() + 2 * MS_PER_DAY);

    const items = (await db
      .collection("pantryItems")
      .find({
        expiresAt: { $gte: now, $lte: until },
      })
      .toArray()) as unknown as PantryDoc[];

    const subscriptions = (await db
      .collection("pushSubscriptions")
      .find({})
      .toArray()) as unknown as SubDoc[];

    if (subscriptions.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, reason: "no subscriptions" });
    }

    const byUser = new Map<string, PantryDoc[]>();
    const unscoped: PantryDoc[] = [];
    for (const item of items) {
      if (item.userId) {
        const list = byUser.get(String(item.userId)) ?? [];
        list.push(item);
        byUser.set(String(item.userId), list);
      } else {
        unscoped.push(item);
      }
    }

    let sent = 0;
    const errors: string[] = [];

    for (const sub of subscriptions) {
      const relevant = sub.userId
        ? (byUser.get(String(sub.userId)) ?? [])
        : items.length > 0
          ? items
          : unscoped;
      const uniqueNames = [
        ...new Set(
          relevant
            .map((i) => i.name)
            .filter((name): name is string => Boolean(name))
        ),
      ];

      if (uniqueNames.length === 0) continue;

      const body =
        uniqueNames.length === 1
          ? `${uniqueNames[0]} expires within 2 days`
          : `${uniqueNames.length} items expire within 2 days: ${uniqueNames.slice(0, 3).join(", ")}`;

      const subscription: PushSubscriptionJSON = {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime ?? null,
        keys: sub.keys,
      };

      try {
        await sendPushNotification(subscription, {
          title: "EZXpire reminder",
          body,
          url: "/",
        });
        sent += 1;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : "send failed");
      }
    }

    return NextResponse.json({ ok: true, sent, itemCount: items.length, errors });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Cron failed" },
      { status: 500 }
    );
  }
}
