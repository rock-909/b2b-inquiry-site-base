import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  envValues: {
    AIRTABLE_API_KEY: "test-api-key",
    AIRTABLE_BASE_ID: "test-base-id",
    AIRTABLE_TABLE_NAME: "test-table",
    NODE_ENV: "test",
  } as Record<string, string | undefined>,
  runtimeValues: {} as Record<string, string | undefined>,
  configure: vi.fn(),
  base: vi.fn(),
  table: vi.fn(),
  create: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
}));

vi.mock("airtable", () => ({
  default: {
    configure: mocks.configure,
    base: mocks.base,
  },
  configure: mocks.configure,
  base: mocks.base,
}));

vi.mock("@/lib/env", () => ({
  env: mocks.envValues,
  runtimeEnv: mocks.envValues,
  getRuntimeEnvString: (key: string) =>
    mocks.runtimeValues[key] ?? mocks.envValues[key],
  getRuntimeEnvBoolean: (key: string) =>
    (mocks.runtimeValues[key] ?? mocks.envValues[key]) === "true",
  getRuntimeNodeEnv: () => "test",
  isRuntimePlaywright: () => false,
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
  productName: "General RFQ",
};

function createdRecord(id = "rec-config") {
  return {
    id,
    fields: {},
    get: vi.fn().mockReturnValue("2026-08-03T00:00:00.000Z"),
  };
}

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

    mocks.configure.mockReset();
    mocks.create.mockReset().mockResolvedValue([createdRecord()]);
    mocks.table.mockReset().mockReturnValue({ create: mocks.create });
    mocks.base.mockReset().mockReturnValue({ table: mocks.table });
    mocks.warn.mockReset();
    mocks.info.mockReset();
    mocks.error.mockReset();
  });

  it("initializes Airtable lazily on first createLead call", async () => {
    const service = await createService();
    const { AIRTABLE_REQUEST_TIMEOUT_MS } = await import("../airtable/service");

    expect(service.isReady()).toBe(false);
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(mocks.base).not.toHaveBeenCalled();

    await expect(service.createLead(validLeadData)).resolves.toEqual({
      id: "rec-config",
    });

    expect(mocks.configure).toHaveBeenCalledWith({
      endpointUrl: "https://api.airtable.com",
      apiKey: "test-api-key",
      requestTimeout: AIRTABLE_REQUEST_TIMEOUT_MS,
    });
    expect(mocks.base).toHaveBeenCalledWith("test-base-id");
    expect(mocks.table).toHaveBeenCalledWith("test-table");
    expect(service.isReady()).toBe(true);
  });

  it("uses Contacts as the table name when AIRTABLE_TABLE_NAME is missing", async () => {
    mocks.envValues.AIRTABLE_TABLE_NAME = undefined;
    const service = await createService();

    await service.createLead(validLeadData);

    expect(mocks.table).toHaveBeenCalledWith("Contacts");
  });

  it.each([
    ["API key", { AIRTABLE_API_KEY: undefined }],
    ["base ID", { AIRTABLE_BASE_ID: undefined }],
  ])("stays disabled when the %s is missing", async (_label, missingConfig) => {
    Object.assign(mocks.envValues, missingConfig);
    const service = await createService();

    expect(service.isReady()).toBe(false);
    await expect(service.createLead(validLeadData)).rejects.toThrow(
      "Airtable service is not configured",
    );
    expect(mocks.configure).not.toHaveBeenCalled();
    expect(mocks.base).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(service.isReady()).toBe(false);
  });

  it("surfaces initialization failures from the first createLead call", async () => {
    mocks.configure.mockImplementation(() => {
      throw new Error("Configuration failed");
    });
    const service = await createService();

    await expect(service.createLead(validLeadData)).rejects.toThrow(
      "Airtable service initialization failed: Configuration failed",
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(service.isReady()).toBe(false);
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

    expect(mocks.configure).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "runtime-airtable-key" }),
    );
    expect(mocks.base).toHaveBeenCalledWith("runtime-base-id");
    expect(mocks.table).toHaveBeenCalledWith("Runtime Contacts");
  });
});
