import { ObjectId, type Document, type WithId } from "mongodb";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/lib/auth";
import type { PantryItem } from "@/lib/types";

export const PANTRY_COLLECTION = "pantryItems";

/** Map a Mongo pantry document to the shared PantryItem type. */
export function docToPantryItem(doc: WithId<Document>): PantryItem {
  return {
    _id: doc._id.toString(),
    userId: String(doc.userId),
    name: String(doc.name),
    category: String(doc.category),
    purchaseDate: doc.purchaseDate as Date,
    expiresAt: doc.expiresAt as Date,
    createdAt: doc.createdAt as Date | undefined,
  };
}

/** Parse a date field from JSON; throws a descriptive Error on failure. */
export function parseDate(value: unknown, field: string): Date {
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new Error(`${field} must be a date string (YYYY-MM-DD or ISO).`);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${field} is not a valid date.`);
  }
  return date;
}

/** Require a signed-in user; returns userId or a 401 JSON response. */
export async function requireUserId(): Promise<
  { userId: string } | { error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return {
      error: NextResponse.json(
        { error: "Unauthorized. Sign in to access your pantry." },
        { status: 401 }
      ),
    };
  }
  return { userId: session.user.id };
}

/** Validate and convert a route id to ObjectId, or null if invalid. */
export function parsePantryObjectId(id: string): ObjectId | null {
  if (!ObjectId.isValid(id)) return null;
  return new ObjectId(id);
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
