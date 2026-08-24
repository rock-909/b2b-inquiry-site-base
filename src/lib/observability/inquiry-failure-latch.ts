import "server-only";

import { getRuntimeEnvString } from "@/lib/env";
import { logger } from "@/lib/logger";

/**
 * 询盘交付故障的「事故闩锁」。
 *
 * 真实询盘命中交付或基础设施故障时，在 Upstash 写入一个带 TTL 的单键标记；
 * /api/health?scope=inquiry 读取该标记向外部 uptime 监控暴露 degraded 状态。
 * 设计目标：首次真实故障后约 5-10 分钟内被外部监控通知，无需主动探测
 * Resend/Airtable 配额。
 *
 * 纪律：
 * - 值只含事故类型、时间戳和询盘引用号，不含任何买家 PII。
 * - 所有 Upstash 错误都在此吞掉并降级为日志——观测写入不得改变买家响应。
 * - 刻意不复用 RedisRateLimitStore：这是最窄的 SET/GET，避免触碰已验证的
 *   限流关键路径。
 */

const LATCH_KEY = "obs:inquiry:recent-failure";
const LATCH_TTL_SECONDS = 1800;
const UPSTASH_TIMEOUT_MS = 2000;

export type InquiryIncidentKind =
  | "email_delivery_failed"
  | "airtable_delivery_failed"
  | "delivery_failed"
  | "rate_limit_store_unavailable"
  | "turnstile_unavailable"
  | "unexpected_inquiry_error";

interface IncidentPayload {
  kind: InquiryIncidentKind;
  at: string;
  referenceId?: string | undefined;
}

function getUpstashConfig(): { url: string; token: string } | null {
  const url = getRuntimeEnvString("UPSTASH_REDIS_REST_URL");
  const token = getRuntimeEnvString("UPSTASH_REDIS_REST_TOKEN");

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export function isInquiryObservabilityConfigured(): boolean {
  return getUpstashConfig() !== null;
}

async function upstashFetch(
  url: string,
  token: string,
): Promise<Response | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      signal: controller.signal,
    });
  } catch (error) {
    logger.error("[Observability] Upstash request failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 记录一次真实询盘事故。绝不抛出：观测写入失败只补一条 error 日志，
 * 不改变买家的原始响应。连续失败会覆盖并刷新 TTL——事故持续期间健康
 * 状态不会自动变绿。
 */
export async function recordInquiryIncident(
  kind: InquiryIncidentKind,
  referenceId?: string | undefined,
): Promise<void> {
  const config = getUpstashConfig();

  if (!config) {
    logger.error(
      "[Observability] Inquiry incident occurred but Upstash is not configured",
      { kind },
    );
    return;
  }

  const payload: IncidentPayload = {
    kind,
    at: new Date().toISOString(),
    ...(referenceId ? { referenceId } : {}),
  };

  const latchUrl = `${config.url}/set/${LATCH_KEY}/${encodeURIComponent(
    JSON.stringify(payload),
  )}/ex/${LATCH_TTL_SECONDS}`;

  const response = await upstashFetch(latchUrl, config.token);

  if (!response || !response.ok) {
    logger.error("[Observability] Failed to write inquiry incident latch", {
      kind,
      status: response?.status ?? "no-response",
    });
    return;
  }

  logger.warn("[Observability] Inquiry incident latched", { kind });
}

/**
 * 读取最近是否有真实事故。返回 null 表示无法判定（未配置或 Upstash 不可读），
 * 调用方应按 degraded 处理而不是假定健康。
 */
export async function hasRecentInquiryFailure(): Promise<boolean | null> {
  const config = getUpstashConfig();

  if (!config) {
    return null;
  }

  const getUrl = `${config.url}/get/${LATCH_KEY}`;
  const response = await upstashFetch(getUrl, config.token);

  if (!response || !response.ok) {
    return null;
  }

  try {
    const body = (await response.json()) as { result?: string | null };
    return typeof body.result === "string" && body.result.length > 0;
  } catch (error) {
    logger.error("[Observability] Failed to parse incident latch response", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
}
