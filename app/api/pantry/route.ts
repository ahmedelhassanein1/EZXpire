import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import type { PantryItem } from "@/lib/types";

const PANTRY_COLLECTION = "pantryItems";

/** GET /api/pantry — list pantry items for the signed-in user only. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = await connectToDatabase();
    const docs = await db
      .collection(PANTRY_COLLECTION)
      .find({ userId: session.user.id })
      .sort({ expiresAt: 1 })
      .toArray();

    const items: PantryItem[] = docs.map((doc) => ({
      _id: doc._id.toString(),
      userId: doc.userId as string,
      name: doc.name as string,
      category: doc.category as string,
      purchaseDate: doc.purchaseDate as Date,
      expiresAt: doc.expiresAt as Date,
      createdAt: doc.createdAt as Date | undefined,
    }));

    return NextResponse.json(items);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to load pantry items";
    console.error("GET /api/pantry:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
