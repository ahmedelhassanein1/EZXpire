import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import {
  PANTRY_COLLECTION,
  docToPantryItem,
  errorMessage,
  parseDate,
  requireUserId,
} from "@/lib/pantryHelpers";
import type { PantryItem } from "@/lib/types";

type CreatePantryBody = {
  name?: unknown;
  category?: unknown;
  purchaseDate?: unknown;
  expiresAt?: unknown;
};

/** GET /api/pantry — list pantry items for the signed-in user only. */
export async function GET() {
  try {
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;

    const db = await connectToDatabase();
    const docs = await db
      .collection(PANTRY_COLLECTION)
      .find({ userId: auth.userId })
      .sort({ expiresAt: 1 })
      .toArray();

    const items: PantryItem[] = docs.map(docToPantryItem);
    return NextResponse.json(items);
  } catch (err) {
    const message = errorMessage(err, "Failed to load pantry items");
    console.error("GET /api/pantry:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/pantry — create one pantry item for the signed-in user. */
export async function POST(request: Request) {
  try {
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;

    let body: CreatePantryBody;
    try {
      body = (await request.json()) as CreatePantryBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Send application/json." },
        { status: 400 }
      );
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
      return NextResponse.json(
        { error: errorMessage(err, "Invalid dates") },
        { status: 400 }
      );
    }

    const doc = {
      userId: auth.userId,
      name: body.name.trim(),
      category: body.category.trim(),
      purchaseDate,
      expiresAt,
      createdAt: new Date(),
    };

    const db = await connectToDatabase();
    const result = await db.collection(PANTRY_COLLECTION).insertOne(doc);

    const item: PantryItem = {
      _id: result.insertedId.toString(),
      ...doc,
    };

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    const message = errorMessage(err, "Failed to create pantry item");
    console.error("POST /api/pantry:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
