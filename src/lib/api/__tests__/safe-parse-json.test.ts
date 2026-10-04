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

  it("returns PAYLOAD_TOO_LARGE for a chunked body without content-length that exceeds maxBytes", async () => {
    // 分块总长 20 字节且是合法 JSON，每块都不超限：只有累计计数才能拦住
    const encoder = new TextEncoder();
    const chunks = ['{"a":"', "xxxx", "xxxx", "xxxx", '"}'];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
    const request = new NextRequest("http://localhost/api/test", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit);

    expect(request.headers.get("content-length")).toBeNull();

    const result = await safeParseJson(request, { maxBytes: 10 });

    expect(result).toEqual({
      ok: false,
      errorCode: API_ERROR_CODES.PAYLOAD_TOO_LARGE,
      statusCode: 413,
    });
  });
});
