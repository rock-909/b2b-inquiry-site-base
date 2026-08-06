/**
 * Turnstile Verification
 *
 * Low-level Cloudflare Turnstile verifier used by the lead Turnstile policy.
 */

import { FIVE_SECONDS_MS } from "@/constants/time";
import {
  INQUIRY_TURNSTILE_ACTION,
  TURNSTILE_ALWAYS_PASS_TEST_SECRET,
  TURNSTILE_DUMMY_TEST_TOKEN,
} from "@/constants/turnstile-constants";
import { env, getRuntimeEnvBoolean, getRuntimeEnvString } from "@/lib/env";
import { logger, sanitizeIP } from "@/lib/logger";
import {
  getAllowedTurnstileHosts,
  isAllowedTurnstileHostname,
} from "@/lib/security/turnstile-config";

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
 * 串行最坏耗时，而那个和是这个数加上邮件与 Airtable 的预算。
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

    return response.json() as Promise<TurnstileVerificationResult>;
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
    action: result.action,
    expectedAction: INQUIRY_TURNSTILE_ACTION,
    ip: sanitizeIP(ip),
  });
  return false;
}

function shouldBypassTurnstile(ip: string): boolean {
  const isDevelopment = getRuntimeEnvString("NODE_ENV") === "development";
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

function handleTurnstileFailure(
  result: TurnstileVerificationResult,
  ip: string,
): { success: false; errorCodes?: string[] } {
  logger.warn("Turnstile verification failed:", {
    errorCodes: result["error-codes"],
    clientIP: sanitizeIP(ip),
  });
  const errorCodes = result["error-codes"];
  return errorCodes ? { success: false, errorCodes } : { success: false };
}

/**
 * Verify a Turnstile token with detailed result.
 */
export async function verifyTurnstileDetailed(
  token: string,
  ip: string,
): Promise<{ success: boolean; errorCodes?: string[] }> {
  try {
    if (shouldBypassTurnstile(ip)) {
      return { success: true };
    }

    const secretKey =
      getRuntimeEnvString("TURNSTILE_SECRET_KEY") ?? env.TURNSTILE_SECRET_KEY;

    if (!secretKey) {
      logger.warn("Turnstile secret key not configured");
      return { success: false, errorCodes: ["not-configured"] };
    }

    const payload = buildTurnstilePayload(token, ip, secretKey);
    const result = await requestTurnstileVerification(payload);

    if (!result.success) {
      return handleTurnstileFailure(result, ip);
    }

    if (
      !isOfficialPreviewTestContract(token, secretKey) &&
      !validateTurnstileHostnameResponse(result, ip)
    ) {
      return { success: false, errorCodes: ["invalid-hostname"] };
    }

    if (
      !isOfficialPreviewTestContract(token, secretKey) &&
      !validateTurnstileActionResponse(result, ip)
    ) {
      return { success: false, errorCodes: ["invalid-action"] };
    }

    logger.info("Turnstile verification attempt", {
      success: true,
      hostname: result.hostname,
      clientIP: sanitizeIP(ip),
    });

    return { success: true };
  } catch (error) {
    // Network errors (timeout, DNS failure, Cloudflare outage) are returned as
    // a structured failure instead of re-throwing so callers always receive
    // Promise<TurnstileVerificationResult> without an unexpected exception path.
    const errorCode =
      error instanceof Error && error.name === "AbortError"
        ? "timeout"
        : "network-error";
    logger.error("Turnstile verification network failure", {
      errorCode,
      ip: sanitizeIP(ip),
      error,
    });
    return { success: false, errorCodes: [errorCode] };
  }
}
