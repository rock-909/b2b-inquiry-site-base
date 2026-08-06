import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Turnstile hosts are mocked to a single non-production host so the assertion
// isolates the base-URL-derived origin.
vi.mock("@/lib/security/turnstile-config", () => ({
  getAllowedTurnstileHosts: () => ["localhost"],
}));

// Read env straight from process.env so each test controls exactly which URL
// variables are present.
vi.mock("@/lib/env", () => ({
  getRuntimeEnvString: (key: string) => process.env[key],
}));

describe("CORS base URL origin", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    delete process.env.CORS_ALLOWED_ORIGINS;
    delete process.env.NEXT_PUBLIC_BASE_URL;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  it("includes the canonical site URL origin when only NEXT_PUBLIC_SITE_URL is set", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://tucsenberg.example";
    vi.resetModules();

    const { getAllowedCorsOrigins } = await import("../cors");

    expect(getAllowedCorsOrigins()).toContain("https://tucsenberg.example");
  });

  it("still honours NEXT_PUBLIC_BASE_URL when set", async () => {
    process.env.NEXT_PUBLIC_BASE_URL = "https://base.example";
    vi.resetModules();

    const { getAllowedCorsOrigins } = await import("../cors");

    expect(getAllowedCorsOrigins()).toContain("https://base.example");
  });
});
