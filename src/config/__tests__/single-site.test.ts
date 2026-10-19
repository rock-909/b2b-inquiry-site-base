import { afterEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { generateMetadataForPath } from "@/lib/seo-metadata";

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

  it("publishes the configured OG image in generated metadata", () => {
    const REFERENCE_OG_IMAGE = SINGLE_SITE_CONFIG.brandAssets.ogImage;
    const metadata = generateMetadataForPath({
      locale: "en",
      pageType: "home",
      path: "/",
    });

    expect(metadata.openGraph?.images).toEqual([{ url: REFERENCE_OG_IMAGE }]);
    expect(metadata.twitter?.images).toEqual([REFERENCE_OG_IMAGE]);
  });
});
