import { NextResponse } from "next/server";
import {
  hasRecentInquiryFailure,
  isInquiryObservabilityConfigured,
} from "@/lib/observability/inquiry-failure-latch";

const HEALTH_HEADERS = {
  "cache-control": "no-store",
} as const;

function ok(): NextResponse {
  return NextResponse.json({ status: "ok" }, { headers: HEALTH_HEADERS });
}

function degraded(): NextResponse {
  return NextResponse.json(
    { status: "degraded" },
    { status: 503, headers: HEALTH_HEADERS },
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  const scope = new URL(request.url).searchParams.get("scope");

  if (scope !== "inquiry") {
    // 默认语义是 liveness：进程活着就 200。交付健康由 scope=inquiry 承载。
    return ok();
  }

  // readiness 语义：最近 30 分钟内出现过真实询盘交付/基础设施事故，
  // 或无法判定（Upstash 未配置/不可读）时按 degraded 处理，不假定健康。
  if (!isInquiryObservabilityConfigured()) {
    return degraded();
  }

  const hasRecentFailure = await hasRecentInquiryFailure();

  return hasRecentFailure === false ? ok() : degraded();
}
