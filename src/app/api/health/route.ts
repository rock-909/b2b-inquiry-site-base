import { NextResponse } from "next/server";

const HEALTH_HEADERS = {
  "cache-control": "no-store",
} as const;

function ok(): NextResponse {
  return NextResponse.json({ status: "ok" }, { headers: HEALTH_HEADERS });
}

export function GET(): NextResponse {
  return ok();
}
