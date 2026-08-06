import { NextResponse } from "next/server";

const HEALTH_HEADERS = {
  "cache-control": "no-store",
} as const;

export function GET() {
  return NextResponse.json({ status: "ok" }, { headers: HEALTH_HEADERS });
}
