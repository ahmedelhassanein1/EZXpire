import { NextResponse } from "next/server";
import { getPushDb } from "@/lib/push-db";
import type { PushSubscriptionJSON } from "@/lib/push";

export const runtime = "nodejs";

type SubscribeBody = {
  subscription?: PushSubscriptionJSON;
  userId?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubscribeBody;
    const subscription = body.subscription;
    if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    if (!process.env.MONGODB_URI) {
      return NextResponse.json(
        {
          error:
            "MONGODB_URI is not set. Push subscriptions need MongoDB (Person 1 / Atlas).",
        },
        { status: 503 }
      );
    }

    const db = await getPushDb();
    await db.collection("pushSubscriptions").updateOne(
      { endpoint: subscription.endpoint },
      {
        $set: {
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          expirationTime: subscription.expirationTime ?? null,
          userId: body.userId ?? null,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Subscribe failed" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { endpoint?: string };
    if (!body.endpoint) {
      return NextResponse.json({ error: "endpoint required" }, { status: 400 });
    }
    if (!process.env.MONGODB_URI) {
      return NextResponse.json({ error: "MONGODB_URI is not set" }, { status: 503 });
    }
    const db = await getPushDb();
    await db.collection("pushSubscriptions").deleteOne({ endpoint: body.endpoint });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unsubscribe failed" },
      { status: 500 }
    );
  }
}
