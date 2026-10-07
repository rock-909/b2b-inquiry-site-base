import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type LeadTurnstileVerificationInput,
  verifyLeadTurnstile,
} from "../lead-turnstile";
import { verifyTurnstileDetailed } from "@/lib/security/turnstile";

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
  verifyTurnstileDetailed: vi.fn(async () => ({ status: "verified" })),
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

  it("passes the trimmed token and client IP to the verifier and returns its classification", async () => {
    vi.mocked(verifyTurnstileDetailed).mockResolvedValueOnce({
      status: "service-unavailable",
    });

    const result = await verifyLeadTurnstile(
      createInput({ token: "  valid-token  " }),
    );

    expect(result).toEqual({ status: "service-unavailable" });
    expect(verifyTurnstileDetailed).toHaveBeenCalledWith(
      "valid-token",
      "203.0.113.10",
    );
  });

  it("does not log raw tokens or raw IP addresses for a missing token", async () => {
    await verifyLeadTurnstile(createInput({ token: "   " }));

    const loggedText = JSON.stringify([
      mockLoggerWarn.mock.calls,
      mockLoggerError.mock.calls,
    ]);
    expect(loggedText).not.toContain("203.0.113.10");
    expect(loggedText).toContain("[REDACTED_IP]");
  });
});
