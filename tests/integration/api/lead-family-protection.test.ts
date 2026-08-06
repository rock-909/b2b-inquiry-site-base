import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import * as inquiryRoute from "@/app/api/inquiry/route";
import { processValidatedInquiry } from "@/lib/lead-pipeline/process-lead";

/**
 * Protection contract checks for the remaining lead API family.
 *
 * This suite asserts the starter-default lead route gates: body parsing,
 * rate-limit, Turnstile, and no default replay-key requirement. It still uses
 * mocks around the deeper processing pipeline, so treat it as an
 * integration-layer guard rather than deployed proof.
 */
vi.mock("@/lib/security/distributed-rate-limit", () => ({
  checkDistributedRateLimit: vi.fn(async () => ({
    allowed: true,
    remaining: 5,
    resetTime: Date.now() + 60000,
    retryAfter: null,
  })),
  createRateLimitHeaders: vi.fn(() => new Headers()),
}));

vi.mock("@/lib/security/turnstile", () => ({
  verifyTurnstileDetailed: vi.fn(async () => ({ success: true })),
}));

vi.mock("@/lib/lead-pipeline/process-lead", () => ({
  processValidatedInquiry: vi.fn(async () => ({
    success: true,
    emailSent: true,
    ownerNotified: true,
    recordCreated: true,
    referenceId: "lead-ref-001",
  })),
}));

vi.mock("@/lib/lead-pipeline/lead-schema", () => ({
  PRODUCT_LEAD_TYPE: "product",
  productLeadSchema: {
    safeParse: vi.fn((input: Record<string, unknown>) => ({
      success: true,
      data: {
        ...input,
        type: "product",
      },
    })),
  },
}));

function makeRequest(
  pathname: string,
  body: unknown,
  headers: HeadersInit = {},
): NextRequest {
  return new NextRequest(
    new Request(`http://localhost${pathname}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...(headers as Record<string, string>),
      },
    }),
  );
}

describe("lead API family protection contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starter lead routes do not require replay keys by default", async () => {
    const inquiry = await inquiryRoute.POST(
      makeRequest("/api/inquiry", {
        email: "buyer@example.com",
        fullName: "Buyer",
        company: "Buyer Co",
        productInquiryKind: "catalog-product",
        catalogProductId: "abs-flood-barriers",
        turnstileToken: "valid-token",
      }),
    );

    expect(inquiry.status).toBe(200);
    expect(vi.mocked(processValidatedInquiry)).toHaveBeenCalledTimes(1);
  });

  it("write-path family routes return 429 under rate limiting", async () => {
    const rateLimit = await import("@/lib/security/distributed-rate-limit");
    vi.mocked(rateLimit.checkDistributedRateLimit).mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetTime: Date.now() + 60000,
      retryAfter: 60,
    });

    const inquiry = await inquiryRoute.POST(
      makeRequest("/api/inquiry", {
        turnstileToken: "valid-token",
        email: "buyer@example.com",
        fullName: "Buyer",
        company: "Buyer Co",
        productInquiryKind: "catalog-product",
        catalogProductId: "abs-flood-barriers",
      }),
    );

    expect(inquiry.status).toBe(429);
  });

  it("inquiry rejects missing turnstile tokens before processing", async () => {
    const inquiry = await inquiryRoute.POST(
      makeRequest("/api/inquiry", {
        email: "buyer@example.com",
        fullName: "Buyer",
        company: "Buyer Co",
        productInquiryKind: "catalog-product",
        catalogProductId: "abs-flood-barriers",
      }),
    );

    expect((await inquiry.json()).errorCode).toBe(
      API_ERROR_CODES.TURNSTILE_REQUIRED,
    );
    expect(vi.mocked(processValidatedInquiry)).not.toHaveBeenCalled();
  });
});
