import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  envValues: {
    AIRTABLE_API_KEY: "test-api-key",
    AIRTABLE_BASE_ID: "test-base-id",
    AIRTABLE_TABLE_NAME: "test-table",
    NODE_ENV: "test",
  } as Record<string, string | undefined>,
  runtimeValues: {} as Record<string, string | undefined>,
  fetch: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  env: mocks.envValues,
  runtimeEnv: mocks.envValues,
  getRuntimeEnvString: (key: string) =>
    mocks.runtimeValues[key] ?? mocks.envValues[key],
  getRuntimeEnvBoolean: (key: string) =>
    (mocks.runtimeValues[key] ?? mocks.envValues[key]) === "true",
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    warn: mocks.warn,
    info: mocks.info,
    error: mocks.error,
    debug: vi.fn(),
  },
  sanitizeEmail: (value: string | undefined | null) =>
    value ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
}));

const validLeadData = {
  firstName: "Config",
  lastName: "Tester",
  email: "config@example.com",
  message: "Configuration test inquiry",
  interest: "Configuration check",
};

async function createService() {
  const { AirtableService } = await import("../airtable/service");
  return new AirtableService();
}

describe("Airtable Service configuration", () => {
  beforeEach(() => {
    vi.resetModules();

    mocks.envValues.AIRTABLE_API_KEY = "test-api-key";
    mocks.envValues.AIRTABLE_BASE_ID = "test-base-id";
    mocks.envValues.AIRTABLE_TABLE_NAME = "test-table";
    mocks.envValues.NODE_ENV = "test";
    for (const key of Object.keys(mocks.runtimeValues)) {
      delete mocks.runtimeValues[key];
    }

    mocks.fetch.mockReset().mockResolvedValue(
      new Response(JSON.stringify({ records: [{ id: "rec-config" }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.warn.mockReset();
    mocks.info.mockReset();
    mocks.error.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("uses the native records API with an abort signal", async () => {
    const service = await createService();
    const { AIRTABLE_REQUEST_TIMEOUT_MS } = await import("../airtable/service");

    await expect(service.createLead(validLeadData)).resolves.toEqual({
      id: "rec-config",
    });

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/test-base-id/test-table",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test-api-key",
        }),
        signal: expect.any(AbortSignal),
      }),
    );
    expect(AIRTABLE_REQUEST_TIMEOUT_MS).toBe(8000);
  });

  it("aborts the native request after the Airtable timeout", async () => {
    const controller = new AbortController();
    const timeout = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValue(controller.signal);
    mocks.fetch.mockImplementationOnce((_input, init) => {
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(init.signal?.reason);
        });
      });
    });
    const service = await createService();
    const { AIRTABLE_REQUEST_TIMEOUT_MS } = await import("../airtable/service");

    const request = service.createLead(validLeadData);
    controller.abort(new DOMException("Timed out", "TimeoutError"));

    await expect(request).rejects.toThrow("Failed to create lead record");
    expect(timeout).toHaveBeenCalledWith(AIRTABLE_REQUEST_TIMEOUT_MS);
    expect(mocks.fetch.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
  });

  it("uses Contacts as the table name when AIRTABLE_TABLE_NAME is missing", async () => {
    mocks.envValues.AIRTABLE_TABLE_NAME = undefined;
    const service = await createService();

    await service.createLead(validLeadData);

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/test-base-id/Contacts",
      expect.any(Object),
    );
  });

  it.each([
    ["API key", { AIRTABLE_API_KEY: undefined }],
    ["base ID", { AIRTABLE_BASE_ID: undefined }],
  ])("stays disabled when the %s is missing", async (_label, missingConfig) => {
    Object.assign(mocks.envValues, missingConfig);
    const service = await createService();

    await expect(service.createLead(validLeadData)).rejects.toThrow(
      "Airtable service is not configured",
    );
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("surfaces native fetch failures from createLead", async () => {
    mocks.fetch.mockRejectedValueOnce(new Error("Network failed"));
    const service = await createService();

    await expect(service.createLead(validLeadData)).rejects.toThrow(
      "Failed to create lead record",
    );
  });

  it("reads Cloudflare runtime env populated after construction", async () => {
    mocks.envValues.AIRTABLE_API_KEY = undefined;
    mocks.envValues.AIRTABLE_BASE_ID = undefined;
    mocks.envValues.AIRTABLE_TABLE_NAME = undefined;
    const service = await createService();

    mocks.runtimeValues.AIRTABLE_API_KEY = "runtime-airtable-key";
    mocks.runtimeValues.AIRTABLE_BASE_ID = "runtime-base-id";
    mocks.runtimeValues.AIRTABLE_TABLE_NAME = "Runtime Contacts";

    await service.createLead(validLeadData);

    expect(mocks.fetch).toHaveBeenCalledWith(
      "https://api.airtable.com/v0/runtime-base-id/Runtime%20Contacts",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer runtime-airtable-key",
        }),
      }),
    );
  });
});
