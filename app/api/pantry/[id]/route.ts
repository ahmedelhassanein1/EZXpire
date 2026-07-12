import { ObjectId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import type { PantryItem } from "@/lib/types";

const PANTRY_COLLECTION = "pantryItems";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdatePantryBody = {
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

/** PATCH /api/pantry/[id] — update an item owned by the signed-in user. */
export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    let body: UpdatePantryBody;
    try {
      body = (await request.json()) as UpdatePantryBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
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
      const message = err instanceof Error ? err.message : "Invalid dates";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Provide at least one field to update" },
        { status: 400 }
      );
    }

    const db = await connectToDatabase();
    const result = await db.collection(PANTRY_COLLECTION).findOneAndUpdate(
      { _id: new ObjectId(id), userId: session.user.id },
      { $set: updates },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const item: PantryItem = {
      _id: result._id.toString(),
      userId: result.userId as string,
      name: result.name as string,
      category: result.category as string,
      purchaseDate: result.purchaseDate as Date,
      expiresAt: result.expiresAt as Date,
      createdAt: result.createdAt as Date | undefined,
    };

    return NextResponse.json(item);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to update pantry item";
    console.error("PATCH /api/pantry/[id]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/pantry/[id] — delete an item owned by the signed-in user. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
    }

    const db = await connectToDatabase();
    const result = await db.collection(PANTRY_COLLECTION).deleteOne({
      _id: new ObjectId(id),
      userId: session.user.id,
    });

    if (result.deletedCount !== 1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to delete pantry item";
    console.error("DELETE /api/pantry/[id]:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
