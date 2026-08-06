import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("@/lib/logger", () => ({
  logger: { warn: mockWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

async function loadTurnstileConfig({
  allowedHosts,
  baseUrl = "https://example.com",
}: {
  allowedHosts?: string;
  baseUrl?: string | null;
} = {}) {
  vi.resetModules();
  vi.doMock("@/lib/env", () => ({
    env: {
      TURNSTILE_ALLOWED_HOSTS: allowedHosts,
    },
    getRuntimeEnvString: () => undefined,
  }));
  vi.doMock("@/config/paths/site-config", () => ({
    SITE_CONFIG: { baseUrl },
  }));
  return import("@/lib/security/turnstile-config");
}

describe("turnstile-config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.doUnmock("@/lib/env");
    vi.doUnmock("@/config/paths/site-config");
  });

  it("parses configured hosts by trimming, lowercasing, and dropping empties", async () => {
    const mod = await loadTurnstileConfig({
      allowedHosts: " EXAMPLE.com, ,Preview.Example.com ",
    });

    expect(mod.getAllowedTurnstileHosts()).toEqual([
      "example.com",
      "preview.example.com",
    ]);
    expect(mod.isAllowedTurnstileHostname("EXAMPLE.COM")).toBe(true);
    expect(mod.isAllowedTurnstileHostname("unknown.example")).toBe(false);
  });

  it("falls back to normalized site host plus localhost", async () => {
    const mod = await loadTurnstileConfig({
      baseUrl: "https://Preview.Example.com",
    });

    expect(mod.getAllowedTurnstileHosts()).toEqual(
      expect.arrayContaining(["preview.example.com", "localhost"]),
    );
    expect(mod.getAllowedTurnstileHosts()).not.toEqual(
      expect.arrayContaining(["feature-branch.preview.example"]),
    );
  });

  it("logs and skips invalid fallback base urls", async () => {
    const mod = await loadTurnstileConfig({ baseUrl: "://bad-url" });

    expect(mod.getAllowedTurnstileHosts()).toEqual(["localhost"]);
    expect(mockWarn).toHaveBeenCalledWith(
      "Failed to parse site base URL for Turnstile host validation",
      expect.objectContaining({
        baseUrl: "://bad-url",
        error: expect.anything(),
      }),
    );
  });

  it("skips blank base urls without warning and still keeps localhost", async () => {
    const mod = await loadTurnstileConfig({
      baseUrl: "   ",
    });

    expect(mod.getAllowedTurnstileHosts()).toEqual(["localhost"]);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("handles a missing base url by falling back to localhost without warning", async () => {
    const mod = await loadTurnstileConfig({ baseUrl: null });

    expect(mod.getAllowedTurnstileHosts()).toEqual(["localhost"]);
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it("rejects empty hostnames", async () => {
    const mod = await loadTurnstileConfig();

    expect(mod.isAllowedTurnstileHostname(undefined)).toBe(false);
    expect(mod.isAllowedTurnstileHostname(null)).toBe(false);
  });
});
