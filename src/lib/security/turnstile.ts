/**
 * Turnstile Verification
 *
 * Low-level Cloudflare Turnstile verifier used by the lead Turnstile policy.
 *
 * 失败分类和诊断日志都在这里完成：每次失败只在分类处记一条日志。
 */

import { FIVE_SECONDS_MS } from "@/constants/time";
import {
  INQUIRY_TURNSTILE_ACTION,
  TURNSTILE_ALWAYS_PASS_TEST_SECRET,
  TURNSTILE_DUMMY_TEST_TOKEN,
} from "@/constants/turnstile-constants";
import {
  env,
  getRuntimeEnvBoolean,
  getRuntimeEnvString,
  isRuntimeDevelopment,
} from "@/lib/env";
import { logger, sanitizeIP } from "@/lib/logger";
import {
  getAllowedTurnstileHosts,
  isAllowedTurnstileHostname,
} from "@/lib/security/turnstile-config";

/**
 * `failed` 是买家令牌被拒（400）；`service-unavailable` 是我们或 Cloudflare 一侧
 * 的故障（503）——缺密钥、网络、超时、provider 的 `internal-error`。
 */
export type TurnstileVerification =
  | { status: "verified" }
  | { status: "failed" }
  | { status: "service-unavailable" };

interface TurnstileVerificationResult {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

function buildTurnstilePayload(
  token: string,
  ip: string,
  secretKey: string,
): URLSearchParams {
  const payload = new URLSearchParams({
    secret: secretKey,
    response: token,
  });

  if (ip && ip !== "unknown") {
    payload.set("remoteip", ip);
  }

  return payload;
}

/**
 * 向 Cloudflare 校验一次令牌的硬超时。
 *
 * 具名并导出，是为了让浏览器那侧的提交预算能跟它对账：预算必须盖住服务端
 * 验证预算，加上限流预算和两个并行交付通道中较长的预算。
 */
export const TURNSTILE_VERIFY_TIMEOUT_MS = FIVE_SECONDS_MS;

async function requestTurnstileVerification(
  payload: URLSearchParams,
): Promise<TurnstileVerificationResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    TURNSTILE_VERIFY_TIMEOUT_MS,
  );

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw new Error(
        `Turnstile API returned ${response.status}: ${response.statusText}`,
      );
    }

    const result: unknown = await response.json();
    if (
      result === null ||
      typeof result !== "object" ||
      !("success" in result) ||
      typeof result.success !== "boolean"
    ) {
      throw new Error("Invalid Turnstile response");
    }
    const fields = result as Record<string, unknown>;
    if (
      (fields.hostname !== undefined && typeof fields.hostname !== "string") ||
      (fields.action !== undefined && typeof fields.action !== "string") ||
      (fields["error-codes"] !== undefined &&
        (!Array.isArray(fields["error-codes"]) ||
          !fields["error-codes"].every((code) => typeof code === "string")))
    ) {
      throw new Error("Invalid Turnstile response");
    }
    return result as TurnstileVerificationResult;
  } finally {
    clearTimeout(timeout);
  }
}

function validateTurnstileHostnameResponse(
  result: TurnstileVerificationResult,
  ip: string,
): boolean {
  if (isAllowedTurnstileHostname(result.hostname)) {
    return true;
  }

  logger.warn("Turnstile verification rejected due to unexpected hostname", {
    errorCode: "invalid-hostname",
    hostname: result.hostname,
    allowed: getAllowedTurnstileHosts(),
    ip: sanitizeIP(ip),
  });
  return false;
}

function validateTurnstileActionResponse(
  result: TurnstileVerificationResult,
  ip: string,
): boolean {
  const actualAction = result.action?.trim();
  if (actualAction === INQUIRY_TURNSTILE_ACTION) {
    return true;
  }

  logger.warn("Turnstile verification rejected due to mismatched action", {
    errorCode: "invalid-action",
    action: result.action,
    expectedAction: INQUIRY_TURNSTILE_ACTION,
    ip: sanitizeIP(ip),
  });
  return false;
}

function shouldBypassTurnstile(ip: string): boolean {
  const isDevelopment = isRuntimeDevelopment();
  const isBypassEnabled = getRuntimeEnvBoolean("TURNSTILE_BYPASS") === true;

  if (isDevelopment && isBypassEnabled) {
    logger.warn("[DEV] Turnstile verification bypassed", {
      ip: sanitizeIP(ip),
    });
    return true;
  }
  return false;
}

function isOfficialPreviewTestContract(
  token: string,
  secretKey: string,
): boolean {
  return (
    getRuntimeEnvString("APP_ENV") === "preview" &&
    getRuntimeEnvBoolean("NEXT_PUBLIC_TEST_MODE") === true &&
    secretKey === TURNSTILE_ALWAYS_PASS_TEST_SECRET &&
    token === TURNSTILE_DUMMY_TEST_TOKEN
  );
}

function classifyProviderFailure(
  result: TurnstileVerificationResult,
  ip: string,
): TurnstileVerification {
  const errorCodes = result["error-codes"];

  // Cloudflare siteverify returns `internal-error` for a retryable server-side
  // fault. Treating it as a service failure (503) avoids rejecting a genuine
  // buyer's lead with a 400 when the fault is on Cloudflare's side.
  if (errorCodes?.includes("internal-error")) {
    logger.error("Turnstile verification unavailable", {
      errorCodes,
      clientIP: sanitizeIP(ip),
    });
    return { status: "service-unavailable" };
  }

  logger.warn("Turnstile verification failed:", {
    errorCodes,
    clientIP: sanitizeIP(ip),
  });
  return { status: "failed" };
}

/**
 * 校验一次令牌并直接给出分类结果，调用方不需要再解码任何错误码。
 */
export async function verifyTurnstileDetailed(
  token: string,
  ip: string,
): Promise<TurnstileVerification> {
  try {
    if (shouldBypassTurnstile(ip)) {
      return { status: "verified" };
    }

    const secretKey =
      getRuntimeEnvString("TURNSTILE_SECRET_KEY") ?? env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      logger.error("Turnstile secret key not configured", {
        ip: sanitizeIP(ip),
      });
      return { status: "service-unavailable" };
    }

    const payload = buildTurnstilePayload(token, ip, secretKey);
    const result = await requestTurnstileVerification(payload);

    if (!result.success) {
      return classifyProviderFailure(result, ip);
    }

    if (
      !isOfficialPreviewTestContract(token, secretKey) &&
      !validateTurnstileHostnameResponse(result, ip)
    ) {
      return { status: "failed" };
    }

    if (
      !isOfficialPreviewTestContract(token, secretKey) &&
      !validateTurnstileActionResponse(result, ip)
    ) {
      return { status: "failed" };
    }

    logger.info("Turnstile verification attempt", {
      success: true,
      hostname: result.hostname,
      clientIP: sanitizeIP(ip),
    });

    return { status: "verified" };
  } catch (error) {
    // 网络错误（超时、DNS 失败、Cloudflare 故障）归为 service-unavailable 而不是
    // 重新抛出，调用方始终拿到 TurnstileVerification，不会有意外的异常路径。
    const errorCode =
      error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : "network-error";
    logger.error("Turnstile verification network failure", {
      errorCode,
      ip: sanitizeIP(ip),
    });
    return { status: "service-unavailable" };
  }
}
