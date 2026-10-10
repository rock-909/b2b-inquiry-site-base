import { describe, expect, it } from "vitest";
import {
  checkedInquiryStub,
  inquiryResponseSchema,
} from "../helpers/inquiry-contract";

describe("inquiry browser stub contract", () => {
  it("serializes a checked cooldown response including its header", () => {
    const stub = checkedInquiryStub({
      status: 429,
      headers: { "Retry-After": "2" },
      body: { success: false, errorCode: "RATE_LIMIT_EXCEEDED" },
    });
    expect(stub.status).toBe(429);
    expect(stub.headers).toEqual({ "Retry-After": "2" });
    expect(JSON.parse(stub.body)).toEqual({
      success: false,
      errorCode: "RATE_LIMIT_EXCEEDED",
    });
  });

  it.each([
    { status: 200, body: { success: true, data: {} } },
    { status: 200, body: { success: false, errorCode: "TURNSTILE_REJECTED" } },
    { status: 429, body: { success: false, errorCode: "RATE_LIMIT_EXCEEDED" } },
    {
      status: 429,
      headers: { "Retry-After": "later" },
      body: { success: false, errorCode: "RATE_LIMIT_EXCEEDED" },
    },
    { status: 400, body: { success: false, errorCode: "INVENTED_CODE" } },
  ])("rejects an API-incompatible stub: %j", (candidate) => {
    expect(inquiryResponseSchema.safeParse(candidate).success).toBe(false);
  });
});
