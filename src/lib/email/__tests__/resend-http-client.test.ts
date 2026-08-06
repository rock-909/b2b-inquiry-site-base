import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ResendHttpEmailClient,
  type ResendEmailPayload,
} from "@/lib/email/resend-http-client";

interface FetchCall {
  input: Parameters<typeof fetch>[0];
  init: Parameters<typeof fetch>[1];
}

const SAMPLE_PAYLOAD: ResendEmailPayload = {
  from: "sender@example.com",
  to: ["buyer@example.com"],
  replyTo: "reply@example.com",
  subject: "Sample inquiry",
  html: "<p>Hello</p>",
  text: "Hello",
  tags: [{ name: "type", value: "contact-form" }],
};

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseRequestBody(
  init: RequestInit | undefined,
): Record<string, unknown> {
  if (typeof init?.body !== "string") {
    throw new Error("Expected Resend request body to be a JSON string");
  }

  const parsed = JSON.parse(init.body) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Expected Resend request body to be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

describe("ResendHttpEmailClient", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends a lean Resend email payload over HTTP", async () => {
    const calls: FetchCall[] = [];
    const fetchFn: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return createJsonResponse({ id: "email-id" });
    };
    const client = new ResendHttpEmailClient("test-api-key", fetchFn);

    const result = await client.send(SAMPLE_PAYLOAD);

    expect(result).toEqual({ data: { id: "email-id" }, error: null });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.input).toBe("https://api.resend.com/emails");
    expect(calls[0]?.init).toEqual(
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-api-key",
          "Content-Type": "application/json",
        },
      }),
    );
    expect(parseRequestBody(calls[0]?.init)).toEqual({
      from: "sender@example.com",
      to: ["buyer@example.com"],
      reply_to: "reply@example.com",
      subject: "Sample inquiry",
      html: "<p>Hello</p>",
      text: "Hello",
      tags: [{ name: "type", value: "contact-form" }],
    });
  });

  it.each([undefined, null, "", "   "])(
    "fails closed for invalid message id %j",
    async (id) => {
      const fetchFn: typeof fetch = async () => createJsonResponse({ id });
      const client = new ResendHttpEmailClient("test-api-key", fetchFn);

      await expect(client.send(SAMPLE_PAYLOAD)).resolves.toEqual({
        data: null,
        error: {
          message: "Resend success response is missing a message id",
        },
      });
    },
  );

  it("normalizes a valid message id", async () => {
    const fetchFn: typeof fetch = async () =>
      createJsonResponse({ id: " email-id " });
    const client = new ResendHttpEmailClient("test-api-key", fetchFn);

    await expect(client.send(SAMPLE_PAYLOAD)).resolves.toEqual({
      data: { id: "email-id" },
      error: null,
    });
  });

  it("returns nested Resend API error messages", async () => {
    const fetchFn: typeof fetch = async () =>
      createJsonResponse({ error: { message: "Invalid recipient" } }, 422);
    const client = new ResendHttpEmailClient("test-api-key", fetchFn);

    const result = await client.send(SAMPLE_PAYLOAD);

    expect(result).toEqual({
      data: null,
      error: { message: "Invalid recipient" },
    });
  });

  it("uses the response text when an error body is not JSON", async () => {
    const fetchFn: typeof fetch = async () =>
      new Response("upstream unavailable", { status: 503 });
    const client = new ResendHttpEmailClient("test-api-key", fetchFn);

    const result = await client.send(SAMPLE_PAYLOAD);

    expect(result).toEqual({
      data: null,
      error: { message: "upstream unavailable" },
    });
  });

  it("returns a controlled timeout error when Resend does not respond", async () => {
    vi.useFakeTimers();

    const fetchFn: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!(signal instanceof AbortSignal)) {
          reject(
            new Error("Expected Resend request to include an abort signal"),
          );
          return;
        }

        signal.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        });
      });
    const client = new ResendHttpEmailClient("test-api-key", fetchFn, {
      timeoutMs: 10,
    });

    const resultPromise = client.send(SAMPLE_PAYLOAD);

    await vi.advanceTimersByTimeAsync(10);

    await expect(resultPromise).resolves.toEqual({
      data: null,
      error: { message: "Resend API request timed out" },
    });
  });

  it("keeps the timeout active while reading the Resend response body", async () => {
    vi.useFakeTimers();

    const fetchFn: typeof fetch = async (_input, init) => {
      const signal = init?.signal;
      if (!(signal instanceof AbortSignal)) {
        throw new Error("Expected Resend request to include an abort signal");
      }

      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          signal.addEventListener("abort", () => {
            controller.error(
              new DOMException("The operation was aborted", "AbortError"),
            );
          });
        },
      });

      return new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    const client = new ResendHttpEmailClient("test-api-key", fetchFn, {
      timeoutMs: 10,
    });

    const resultPromise = client.send(SAMPLE_PAYLOAD);

    await vi.advanceTimersByTimeAsync(10);

    const resultOrPending = Promise.race([
      resultPromise,
      new Promise<"pending">((resolve) => {
        setTimeout(() => resolve("pending"), 1);
      }),
    ]);
    await vi.advanceTimersByTimeAsync(1);

    await expect(resultOrPending).resolves.toEqual({
      data: null,
      error: { message: "Resend API request timed out" },
    });
  });

  it("returns a controlled timeout error for non-DOM AbortError instances", async () => {
    vi.useFakeTimers();

    const fetchFn: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!(signal instanceof AbortSignal)) {
          reject(
            new Error("Expected Resend request to include an abort signal"),
          );
          return;
        }

        signal.addEventListener("abort", () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    const client = new ResendHttpEmailClient("test-api-key", fetchFn, {
      timeoutMs: 10,
    });

    const resultPromise = client.send(SAMPLE_PAYLOAD);

    await vi.advanceTimersByTimeAsync(10);

    await expect(resultPromise).resolves.toEqual({
      data: null,
      error: { message: "Resend API request timed out" },
    });
  });
});
