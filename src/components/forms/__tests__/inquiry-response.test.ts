import { describe, expect, it } from "vitest";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { decodeInquirySubmitState } from "@/components/forms/inquiry-response";

describe("decodeInquirySubmitState", () => {
  it.each([
    "errors.email.invalid",
    { length: 1 },
    [null],
    [{ toString: null }],
  ])("rejects malformed field details %j before rendering", async (details) => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
        details,
      }),
      { status: 400 },
    );
    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "server",
    });
  });

  it("returns success with the reference id for an ok success body", async () => {
    const response = new Response(
      JSON.stringify({
        success: true,
        data: { referenceId: "inq-ref-100" },
      }),
      { status: 200 },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "success",
      referenceId: "inq-ref-100",
    });
  });

  it("classifies validation failures as field errors with details", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_VALIDATION_FAILED,
        details: ["errors.fullName.required"],
      }),
      { status: 400 },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "field",
      fieldDetails: ["errors.fullName.required"],
    });
  });

  it("classifies Turnstile failures as security errors", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.TURNSTILE_REJECTED,
      }),
      { status: 400 },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "security",
    });
  });

  it("classifies rate limit errors with a valid Retry-After header", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      }),
      {
        status: 429,
        headers: { "Retry-After": "60" },
      },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "rateLimit",
      retryAfterSeconds: 60,
    });
  });

  it("accepts the legal upper bound of 120 seconds as-is", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      }),
      {
        status: 429,
        headers: { "Retry-After": "120" },
      },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "rateLimit",
      retryAfterSeconds: 120,
    });
  });

  it("accepts a zero Retry-After as an immediate cooldown release", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
      }),
      {
        status: 429,
        headers: { "Retry-After": "0" },
      },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "rateLimit",
      retryAfterSeconds: 0,
    });
  });

  it.each([
    ["missing header", undefined],
    ["non-numeric header", "in a minute"],
    ["negative seconds", "-30"],
    ["absurdly large seconds", "86400"],
  ] as const)(
    "falls back to the default cooldown for %s",
    async (_label, retryAfter) => {
      const headers = new Headers();
      if (retryAfter !== undefined) {
        headers.set("Retry-After", retryAfter);
      }

      const response = new Response(
        JSON.stringify({
          success: false,
          errorCode: API_ERROR_CODES.RATE_LIMIT_EXCEEDED,
        }),
        { status: 429, headers },
      );

      await expect(decodeInquirySubmitState(response)).resolves.toEqual({
        status: "error",
        errorKind: "rateLimit",
        retryAfterSeconds: 60,
      });
    },
  );

  it("classifies processing failures as server errors", async () => {
    const response = new Response(
      JSON.stringify({
        success: false,
        errorCode: API_ERROR_CODES.INQUIRY_PROCESSING_ERROR,
      }),
      { status: 500 },
    );

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "server",
    });
  });

  it("classifies non-JSON responses as server errors", async () => {
    const response = new Response("<html>502</html>", { status: 502 });

    await expect(decodeInquirySubmitState(response)).resolves.toEqual({
      status: "error",
      errorKind: "server",
    });
  });
});
