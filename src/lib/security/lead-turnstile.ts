import "server-only";

import { logger, sanitizeIP } from "@/lib/logger";
import {
  type TurnstileVerification,
  verifyTurnstileDetailed,
} from "@/lib/security/turnstile";

const LEAD_TURNSTILE_ROUTE_LABEL = "/api/inquiry" as const;

export interface LeadTurnstileVerificationInput {
  token: unknown;
  clientIP: string;
}

export type LeadTurnstileVerificationResult =
  { status: "missing" } | TurnstileVerification;

function normalizeTurnstileToken(token: unknown): string | null {
  if (typeof token !== "string") {
    return null;
  }

  const trimmedToken = token.trim();
  return trimmedToken.length > 0 ? trimmedToken : null;
}

export async function verifyLeadTurnstile({
  token,
  clientIP,
}: LeadTurnstileVerificationInput): Promise<LeadTurnstileVerificationResult> {
  const normalizedToken = normalizeTurnstileToken(token);
  if (!normalizedToken) {
    logger.warn("Lead Turnstile token missing", {
      routeLabel: LEAD_TURNSTILE_ROUTE_LABEL,
      ip: sanitizeIP(clientIP),
    });
    return { status: "missing" };
  }

  return await verifyTurnstileDetailed(normalizedToken, clientIP);
}
