import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { rolloverPreviousWeek } from "@/lib/server/leagues";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Vercel Cron: fecha a liga da semana anterior. */
export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const processed = await rolloverPreviousWeek();
  return NextResponse.json({ processed });
}
