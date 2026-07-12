import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";

/**
 * TEMPORARY — Person 1 Prompt 2 connection test.
 * Delete this file after verifying MongoDB connects (check the terminal for "Connected").
 */
export async function GET() {
  try {
    const db = await connectToDatabase();
    console.log(db);
    return NextResponse.json({
      ok: true,
      database: db.databaseName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
