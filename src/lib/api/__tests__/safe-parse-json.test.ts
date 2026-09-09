import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";
import { API_ERROR_CODES } from "@/constants/api-error-codes";
import { safeParseJson } from "../safe-parse-json";

function createRequest(body: BodyInit | null, headers: HeadersInit = {}) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body,
    headers,
  });
}

describe("safeParseJson", () => {
  it("does not log rejected buyer body fragments", async () => {
    const warn = vi.spyOn(logger, "warn").mockImplementation(() => undefined);
    await safeParseJson(createRequest("PRIVATE_BUYER_MESSAGE"));
    expect(warn).toHaveBeenCalled();
    expect(JSON.stringify(warn.mock.calls)).not.toContain("PRIVATE_BU");
    warn.mockRestore();
  });
  it("keeps empty body mapped to INVALID_JSON_BODY by default", async () => {
    const result = await safeParseJson(createRequest(""));

    expect(result).toEqual({
      ok: false,
      errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
      statusCode: 400,
    });
  });

  it("keeps malformed JSON mapped to INVALID_JSON_BODY", async () => {
    const result = await safeParseJson(createRequest("not-json"));

    expect(result).toEqual({
      ok: false,
      errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
      statusCode: 400,
    });
  });

  it("rejects a top-level array", async () => {
    const result = await safeParseJson(createRequest("[]"));

    expect(result).toEqual({
      ok: false,
      errorCode: API_ERROR_CODES.INVALID_JSON_BODY,
      statusCode: 400,
    });
  });

  it("returns PAYLOAD_TOO_LARGE when content-length exceeds maxBytes", async () => {
    const result = await safeParseJson(
      createRequest("{}", { "content-length": "10" }),
      {
        maxBytes: 5,
      },
    );

    expect(result).toEqual({
      ok: false,
      errorCode: API_ERROR_CODES.PAYLOAD_TOO_LARGE,
      statusCode: 413,
    });
  });
});
