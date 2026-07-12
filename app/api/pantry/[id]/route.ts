import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import {
  PANTRY_COLLECTION,
  docToPantryItem,
  errorMessage,
  parseDate,
  parsePantryObjectId,
  requireUserId,
} from "@/lib/pantryHelpers";
import type { PantryItem } from "@/lib/types";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdatePantryBody = {
  name?: unknown;
  category?: unknown;
  purchaseDate?: unknown;
  expiresAt?: unknown;
};

/** PATCH /api/pantry/[id] — update an item owned by the signed-in user. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const objectId = parsePantryObjectId(id);
    if (!objectId) {
      return NextResponse.json(
        { error: "Invalid item id. Expected a MongoDB ObjectId." },
        { status: 400 }
      );
    }

    let body: UpdatePantryBody;
    try {
      body = (await request.json()) as UpdatePantryBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body. Send application/json." },
        { status: 400 }
      );
    }

    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) {
      if (typeof body.name !== "string" || body.name.trim().length === 0) {
        return NextResponse.json(
          { error: "name must be a non-empty string" },
          { status: 400 }
        );
      }
      updates.name = body.name.trim();
    }

    if (body.category !== undefined) {
      if (
        typeof body.category !== "string" ||
        body.category.trim().length === 0
      ) {
        return NextResponse.json(
          { error: "category must be a non-empty string" },
          { status: 400 }
        );
      }
      updates.category = body.category.trim();
    }

    try {
      if (body.purchaseDate !== undefined) {
        updates.purchaseDate = parseDate(body.purchaseDate, "purchaseDate");
      }
      if (body.expiresAt !== undefined) {
        updates.expiresAt = parseDate(body.expiresAt, "expiresAt");
      }
    } catch (err) {
      return NextResponse.json(
        { error: errorMessage(err, "Invalid dates") },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update (name, category, purchaseDate, expiresAt)." },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const result = await db.collection(PANTRY_COLLECTION).findOneAndUpdate(
      { _id: objectId, userId: auth.userId },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json(
        { error: "Pantry item not found for this account." },
        { status: 404 }
      );
    }

    const item: PantryItem = docToPantryItem(result);
    return NextResponse.json(item);
  } catch (err) {
    const message = errorMessage(err, "Failed to update pantry item");
    console.error("PATCH /api/pantry/[id]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/pantry/[id] — delete an item owned by the signed-in user. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const auth = await requireUserId();
    if ("error" in auth) return auth.error;

    const { id } = await context.params;
    const objectId = parsePantryObjectId(id);
    if (!objectId) {
      return NextResponse.json(
        { error: "Invalid item id. Expected a MongoDB ObjectId." },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const result = await db.collection(PANTRY_COLLECTION).deleteOne({
      _id: objectId,
      userId: auth.userId,
    });

    if (result.deletedCount !== 1) {
      return NextResponse.json(
        { error: "Pantry item not found for this account." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = errorMessage(err, "Failed to delete pantry item");
    console.error("DELETE /api/pantry/[id]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
