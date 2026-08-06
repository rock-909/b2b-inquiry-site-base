import { describe, expect, it, vi } from "vitest";

function createEnvMock(runtimeValues: Record<string, string | undefined>) {
  const env = {
    NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
    NEXT_PUBLIC_SITE_URL: undefined,
  };

  return {
    env,
    runtimeEnv: env,
    getRuntimeEnvString: (key: string) => runtimeValues[key],
    getRuntimeEnvBoolean: (key: string) => runtimeValues[key] === "true",
    isRuntimeProduction: () => false,
  };
}

describe("Cloudflare runtime env timing", () => {
  it("lets Resend initialize after Worker secrets are populated at request time", async () => {
    vi.resetModules();

    const runtimeValues: Record<string, string | undefined> = {};
    const constructorCalls = vi.fn();

    vi.doMock("@/lib/env", () => ({
      ...createEnvMock(runtimeValues),
      env: {
        ...createEnvMock(runtimeValues).env,
        RESEND_API_KEY: undefined,
        EMAIL_FROM: undefined,
        EMAIL_REPLY_TO: undefined,
      },
    }));

    vi.doMock("@/lib/email/resend-http-client", () => ({
      ResendHttpEmailClient: class {
        public readonly send = vi.fn();

        constructor(apiKey: string) {
          constructorCalls(apiKey);
        }
      },
    }));

    vi.doMock("@/lib/logger", () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
      sanitizeEmail: (value: string | undefined | null) =>
        value ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
    }));

    const { ResendService } = await import("@/lib/resend-core");
    const service = new ResendService();

    expect(service.isReady()).toBe(false);

    runtimeValues.RESEND_API_KEY = "runtime-resend-key";
    runtimeValues.EMAIL_FROM = "noreply@mail.tucsenberg.com";
    runtimeValues.EMAIL_REPLY_TO = "sales@tucsenberg.com";

    expect(service.isReady()).toBe(true);
    expect(constructorCalls).toHaveBeenCalledWith("runtime-resend-key");
  });

  it("lets Airtable initialize from Worker secrets after service construction", async () => {
    vi.resetModules();

    const runtimeValues: Record<string, string | undefined> = {};
    const configure = vi.fn();
    const create = vi.fn().mockResolvedValue([
      {
        id: "rec-runtime",
        fields: {},
        get: vi.fn().mockReturnValue("2026-07-03T00:00:00.000Z"),
      },
    ]);
    const table = vi.fn().mockReturnValue({ create });
    const base = vi.fn().mockReturnValue({ table });

    vi.doMock("@/lib/env", () => ({
      ...createEnvMock(runtimeValues),
      env: {
        ...createEnvMock(runtimeValues).env,
        AIRTABLE_API_KEY: undefined,
        AIRTABLE_BASE_ID: undefined,
        AIRTABLE_TABLE_NAME: undefined,
      },
    }));

    vi.doMock("airtable", () => ({
      default: { configure, base },
      configure,
      base,
    }));

    vi.doMock("@/lib/logger", () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
      sanitizeEmail: (value: string | undefined | null) =>
        value ? "[REDACTED_EMAIL]" : "[NO_EMAIL]",
    }));

    const { AirtableService } = await import("@/lib/airtable/service");
    const service = new AirtableService();

    runtimeValues.AIRTABLE_API_KEY = "runtime-airtable-key";
    runtimeValues.AIRTABLE_BASE_ID = "appRuntime";
    runtimeValues.AIRTABLE_TABLE_NAME = "Contacts";

    await service.createLead({
      firstName: "Runtime",
      lastName: "Tester",
      email: "runtime@example.com",
      message: "Runtime env should be available when Airtable initializes.",
      productName: "General RFQ",
    });

    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "runtime-airtable-key" }),
    );
    expect(base).toHaveBeenCalledWith("appRuntime");
    expect(table).toHaveBeenCalledWith("Contacts");
  });

  it("lets Turnstile verification read Worker secrets at request time", async () => {
    vi.resetModules();

    const runtimeValues: Record<string, string | undefined> = {};
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "tucsenberg-site-preview.faints-pudgier-9r.workers.dev",
          action: "product_inquiry",
        }),
        { status: 200 },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("@/lib/env", () => ({
      ...createEnvMock(runtimeValues),
      env: {
        ...createEnvMock(runtimeValues).env,
        TURNSTILE_SECRET_KEY: undefined,
        TURNSTILE_ALLOWED_HOSTS: undefined,
      },
    }));
    vi.doMock("@/config/paths/site-config", () => ({
      SITE_CONFIG: { baseUrl: "https://example.com" },
    }));
    vi.doMock("@/lib/logger", () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
      sanitizeIP: () => "[REDACTED_IP]",
    }));

    const { verifyTurnstileDetailed } =
      await import("@/lib/security/turnstile");

    runtimeValues.TURNSTILE_SECRET_KEY = "runtime-turnstile-secret";
    runtimeValues.TURNSTILE_ALLOWED_HOSTS =
      "tucsenberg-site-preview.faints-pudgier-9r.workers.dev";

    await expect(
      verifyTurnstileDetailed("token", "203.0.113.10"),
    ).resolves.toEqual({ success: true });

    const body = fetchMock.mock.calls[0]?.[1]?.body;
    expect(String(body)).toContain("secret=runtime-turnstile-secret");
  });

  it("rejects Turnstile responses whose action does not match INQUIRY_TURNSTILE_ACTION", async () => {
    vi.resetModules();

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: "example.com",
          action: "contact_form",
        }),
        { status: 200 },
      ),
    );

    vi.stubGlobal("fetch", fetchMock);
    vi.doMock("@/lib/env", () => ({
      env: {
        TURNSTILE_SECRET_KEY: "runtime-turnstile-secret",
        TURNSTILE_ALLOWED_HOSTS: "example.com",
      },
      getRuntimeEnvString: (key: string) => {
        if (key === "TURNSTILE_SECRET_KEY") {
          return "runtime-turnstile-secret";
        }
        if (key === "TURNSTILE_ALLOWED_HOSTS") {
          return "example.com";
        }
        return undefined;
      },
      getRuntimeEnvBoolean: () => undefined,
    }));
    vi.doMock("@/config/paths/site-config", () => ({
      SITE_CONFIG: { baseUrl: "https://example.com" },
    }));
    vi.doMock("@/lib/logger", () => ({
      logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
      sanitizeIP: () => "[REDACTED_IP]",
    }));

    const { verifyTurnstileDetailed } =
      await import("@/lib/security/turnstile");

    await expect(
      verifyTurnstileDetailed("token", "203.0.113.10"),
    ).resolves.toEqual({ success: false, errorCodes: ["invalid-action"] });
  });
});
