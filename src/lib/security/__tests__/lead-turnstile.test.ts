import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  mapLeadTurnstileResultToResponse,
  type LeadTurnstileVerificationInput,
  verifyLeadTurnstile,
} from "../lead-turnstile";
import { verifyTurnstileDetailed } from "@/lib/security/turnstile";
import { API_ERROR_CODES } from "@/constants/api-error-codes";

const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mockLoggerWarn,
    error: mockLoggerError,
    info: vi.fn(),
  },
  sanitizeIP: (ip: string | undefined | null) =>
    ip ? "[REDACTED_IP]" : "[NO_IP]",
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstileDetailed: vi.fn(async () => ({ success: true })),
}));

function createInput(
  overrides: Partial<LeadTurnstileVerificationInput> = {},
): LeadTurnstileVerificationInput {
  return {
    token: "valid-token",
    clientIP: "203.0.113.10",
    ...overrides,
  };
}

describe("verifyLeadTurnstile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs the fixed /api/inquiry route label without caller-supplied route input", async () => {
    await verifyLeadTurnstile(createInput({ token: "" }));

    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Lead Turnstile token missing",
      {
        routeLabel: "/api/inquiry",
        ip: "[REDACTED_IP]",
      },
    );
  });

  it.each([undefined, null, "", "   ", 123, false, {}])(
    "classifies %p as missing without calling Turnstile",
    async (token) => {
      const result = await verifyLeadTurnstile(createInput({ token }));

      expect(result).toEqual({ status: "missing" });
      expect(verifyTurnstileDetailed).not.toHaveBeenCalled();
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        "Lead Turnstile token missing",
        {
          routeLabel: "/api/inquiry",
          ip: "[REDACTED_IP]",
        },
      );
    },
  );

  it("calls verifyTurnstileDetailed without a configurable action argument", async () => {
    const result = await verifyLeadTurnstile(createInput());

    expect(result).toEqual({ status: "verified" });
    expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
      "valid-token",
      "203.0.113.10",
    );
  });

  it("classifies invalid token, action, and hostname failures as failed", async () => {
    vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
      success: false,
      errorCodes: ["invalid-action", "invalid-hostname"],
    });

    const result = await verifyLeadTurnstile(createInput());

    expect(result).toEqual({
      status: "failed",
      errorCodes: ["invalid-action", "invalid-hostname"],
    });
    expect(mockLoggerWarn).toHaveBeenCalledWith(
      "Lead Turnstile verification failed",
      {
        routeLabel: "/api/inquiry",
        ip: "[REDACTED_IP]",
        errorCodes: ["invalid-action", "invalid-hostname"],
      },
    );
  });

  it.each([[["not-configured"]], [["network-error"]], [["timeout"]]])(
    "classifies %s as service-unavailable",
    async (errorCodes) => {
      vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
        success: false,
        errorCodes,
      });

      const result = await verifyLeadTurnstile(createInput());

      expect(result).toEqual({
        status: "service-unavailable",
        errorCodes,
      });
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Lead Turnstile verification unavailable",
        {
          routeLabel: "/api/inquiry",
          ip: "[REDACTED_IP]",
          errorCodes,
        },
      );
    },
  );

  it("does not log raw tokens or raw IP addresses", async () => {
    vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
      success: false,
      errorCodes: ["invalid-input-response"],
    });

    await verifyLeadTurnstile(createInput({ token: "secret-token" }));

    const loggedText = JSON.stringify([
      mockLoggerWarn.mock.calls,
      mockLoggerError.mock.calls,
    ]);
    expect(loggedText).not.toContain("secret-token");
    expect(loggedText).not.toContain("203.0.113.10");
    expect(loggedText).toContain("[REDACTED_IP]");
  });
});

describe("mapLeadTurnstileResultToResponse", () => {
  it.each([
    [
      { status: "missing" } as const,
      { errorCode: API_ERROR_CODES.TURNSTILE_REQUIRED, status: 400 },
    ],
    [
      { status: "failed", errorCodes: ["invalid-input-response"] } as const,
      { errorCode: API_ERROR_CODES.TURNSTILE_REJECTED, status: 400 },
    ],
    [
      { status: "service-unavailable", errorCodes: ["timeout"] } as const,
      { errorCode: API_ERROR_CODES.TURNSTILE_UNAVAILABLE, status: 503 },
    ],
  ])("maps %o to the shared lead-family error contract", (result, expected) => {
    expect(mapLeadTurnstileResultToResponse(result)).toEqual(expected);
  });

  it("returns null after successful verification", () => {
    expect(mapLeadTurnstileResultToResponse({ status: "verified" })).toBeNull();
  });
});
