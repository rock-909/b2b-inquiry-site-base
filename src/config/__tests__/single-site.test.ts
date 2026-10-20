import { afterEach, describe, expect, it, vi } from "vitest";
import { assertValidSiteConfig } from "@/config/site-config-schema";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";

const TEMPLATE_BASE_URL = "https://example.invalid";

describe("single-site", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });

  it("uses the Cloudflare preview fallback when no public site URL is explicitly configured", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: {
        NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
        NEXT_PUBLIC_SITE_URL: undefined,
      },
      runtimeEnv: {
        NEXT_PUBLIC_BASE_URL: undefined,
        NEXT_PUBLIC_SITE_URL: undefined,
      },
      getRuntimeEnvString: () => undefined,
      isRuntimeProduction: () => true,
    }));

    const { SINGLE_SITE_CONFIG } = await import("@/config/single-site");

    expect(SINGLE_SITE_CONFIG.baseUrl).toBe(TEMPLATE_BASE_URL);
  });

  it("drops a trailing slash from the configured site URL", async () => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: { NEXT_PUBLIC_SITE_URL: "https://acme-example.com/" },
      runtimeEnv: { NEXT_PUBLIC_SITE_URL: "https://acme-example.com/" },
      getRuntimeEnvString: () => undefined,
      isRuntimeProduction: () => true,
    }));

    const { SINGLE_SITE_CONFIG } = await import("@/config/single-site");

    expect(SINGLE_SITE_CONFIG.baseUrl).toBe("https://acme-example.com");
  });

  it("accepts the template config and rejects malformed identity values", () => {
    expect(() => assertValidSiteConfig(SINGLE_SITE_CONFIG)).not.toThrow();
    expect(() =>
      assertValidSiteConfig({
        ...SINGLE_SITE_CONFIG,
        social: { twitter: "javascript:alert(1)" },
      }),
    ).toThrow(/twitter/u);
    expect(() =>
      assertValidSiteConfig({
        ...SINGLE_SITE_CONFIG,
        contact: { email: "sales@acme.com", phone: "call me" },
      }),
    ).toThrow(/phone/u);
    expect(() =>
      assertValidSiteConfig({
        ...SINGLE_SITE_CONFIG,
        company: { name: "Acme", established: 9999 },
      }),
    ).toThrow(/established/u);
    const logo = {
      status: "ready",
      horizontal: "/logo.svg",
      width: 240,
      height: 72,
    };
    const withLogo = (overrides: object) => ({
      ...SINGLE_SITE_CONFIG,
      brandAssets: {
        ...SINGLE_SITE_CONFIG.brandAssets,
        logo: { ...logo, ...overrides },
      },
    });
    expect(() => assertValidSiteConfig(withLogo({}))).not.toThrow();
    expect(() =>
      assertValidSiteConfig(withLogo({ status: "pending" })),
    ).not.toThrow();
    expect(() =>
      assertValidSiteConfig(
        withLogo({ horizontal: "//evil.example/logo.svg" }),
      ),
    ).toThrow(/horizontal/u);
    expect(() => assertValidSiteConfig(withLogo({ width: 0 }))).toThrow(
      /width/u,
    );
  });
});
