import { NextRequest, type NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { processValidatedInquiry } from "@/lib/lead-pipeline/process-lead";
import * as inquiryRoute from "@/app/api/inquiry/route";

/**
 * Auxiliary response contract checks only.
 *
 * This suite intentionally mocks the core protection and submission pipeline so
 * it can verify response shape. It is not full lead-chain protection proof.
 * Route/action protection suites and deployed canaries own that proof boundary.
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
  extraHeaders: HeadersInit = {},
) {
  return new NextRequest(
    new Request(`http://localhost${pathname}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        ...(extraHeaders as Record<string, string>),
      },
    }),
  );
}

function expectNoLeadObservabilityHeaders(response: Response) {
  expect(response.headers.get("x-request-id")).toBeNull();
  expect(response.headers.get("x-observability-surface")).toBeNull();
}

async function expectRouteError(
  response: NextResponse,
  status: number,
  errorCode: string,
) {
  expect(response.status).toBe(status);
  expectNoLeadObservabilityHeaders(response);
  await expect(response.json()).resolves.toEqual({
    success: false,
    errorCode,
  });
}

describe("lead API family response contract (auxiliary)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inquiry success uses the family success contract", async () => {
    const response = await inquiryRoute.POST(
      makeRequest("/api/inquiry", {
        turnstileToken: "valid-token",
        email: "buyer@example.com",
        fullName: "Buyer",
        company: "Buyer Co",
        productInquiryKind: "catalog-product",
        catalogProductId: "abs-flood-barriers",
      }),
    );

    expect(response.status).toBe(200);
    expectNoLeadObservabilityHeaders(response);
    const body = await response.json();
    expect(body).toEqual({
      success: true,
      data: {
        referenceId: "lead-ref-001",
      },
    });
  });

  it("inquiry missing turnstile uses the family error contract", async () => {
    const response = await inquiryRoute.POST(
      makeRequest("/api/inquiry", {
        email: "buyer@example.com",
        fullName: "Buyer",
        company: "Buyer Co",
        productInquiryKind: "catalog-product",
        catalogProductId: "abs-flood-barriers",
      }),
    );

    expect(response.status).toBe(400);
    expectNoLeadObservabilityHeaders(response);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.TURNSTILE_REQUIRED,
    });
  });

  it("inquiry invalid JSON uses the family error contract", async () => {
    const response = await inquiryRoute.POST(
      new NextRequest(
        new Request("http://localhost/api/inquiry", {
          method: "POST",
          body: "not-json",
          headers: {
            "Content-Type": "application/json",
          },
        }),
      ),
    );

    expect(response.status).toBe(400);
    expectNoLeadObservabilityHeaders(response);
    const body = await response.json();
    expect(body).toEqual({
      success: false,
      errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
    });
  });

  it("inquiry maps pipeline processing failures to route-specific processing errors", async () => {
    vi.mocked(processValidatedInquiry).mockResolvedValue({
      success: false,
      error: "PROCESSING_FAILED",
      emailSent: false,
      ownerNotified: false,
      recordCreated: false,
      referenceId: "lead-ref-failed",
    });

    await expectRouteError(
      await inquiryRoute.POST(
        makeRequest("/api/inquiry", {
          turnstileToken: "valid-token",
          email: "buyer@example.com",
          fullName: "Buyer",
          company: "Buyer Co",
          productInquiryKind: "catalog-product",
          catalogProductId: "abs-flood-barriers",
        }),
      ),
      500,
      API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
    );
  });
});
