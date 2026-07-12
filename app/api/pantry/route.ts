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

type CreatePantryBody = {
  name?: unknown;
  category?: unknown;
  purchaseDate?: unknown;
  expiresAt?: unknown;
};

function parseDate(value: unknown, field: string): Date {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error(`${field} must be a date string (YYYY-MM-DD or ISO).`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} is not a valid date.`);
  }
  return date;
}

/** POST /api/pantry — create one pantry item for the signed-in user. */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: CreatePantryBody;
    try {
      body = (await request.json()) as CreatePantryBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json(
        { error: "name is required and must be a non-empty string" },
        { status: 400 }
      );
    }
    if (typeof body.category !== "string" || body.category.trim().length === 0) {
      return NextResponse.json(
        { error: "category is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    let purchaseDate: Date;
    let expiresAt: Date;
    try {
      purchaseDate = parseDate(body.purchaseDate, "purchaseDate");
      expiresAt = parseDate(body.expiresAt, "expiresAt");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid dates";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const now = new Date();
    const doc = {
      userId: session.user.id,
      name: body.name.trim(),
      category: body.category.trim(),
      purchaseDate,
      expiresAt,
      createdAt: now,
    };

    const db = await connectToDatabase();
    const result = await db.collection(PANTRY_COLLECTION).insertOne(doc);

    const item: PantryItem = {
      _id: result.insertedId.toString(),
      ...doc,
    };

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create pantry item";
    console.error("POST /api/pantry:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
