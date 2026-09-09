import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
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

  it("publishes the configured OG image from a real public asset", () => {
    const REFERENCE_OG_IMAGE = SINGLE_SITE_FACTS.brandAssets.ogImage;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Checked-in asset configuration, not request input.
    expect(existsSync(`public${REFERENCE_OG_IMAGE}`)).toBe(true);

    // A root App Router metadata file also applies to Next's root 404, which
    // sits above the locale layout's metadataBase and falls back to localhost.
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Checked-in asset configuration, not request input.
    expect(existsSync(`src/app${REFERENCE_OG_IMAGE}`)).toBe(false);

    const metadata = generateMetadataForPath({
      locale: "en",
      pageType: "home",
      path: "/",
    });

    expect(metadata.openGraph?.images).toEqual([{ url: REFERENCE_OG_IMAGE }]);
    expect(metadata.twitter?.images).toEqual([REFERENCE_OG_IMAGE]);
  });

  it("keeps owner-dependent public trust assets explicit during cutover", async () => {
    const {
      getPublicContactEmail,
      getPublicContactPhone,
      getPublicLogoPath,
      isPublicEmailConfigured,
      isPublicPhoneConfigured,
    } = await import("@/config/public-trust");

    expect(isPublicEmailConfigured("sales@example.com")).toBe(false);
    expect(isPublicEmailConfigured("sales@asterconveyor.example")).toBe(false);
    expect(isPublicEmailConfigured("hello@starter.dev")).toBe(true);
    expect(getPublicContactEmail("sales@example.com")).toBeUndefined();
    expect(
      getPublicContactEmail("sales@asterconveyor.example"),
    ).toBeUndefined();
    expect(getPublicContactEmail("hello@starter.dev")).toBe(
      "hello@starter.dev",
    );
    expect(isPublicPhoneConfigured("+86-518-0000-0000")).toBe(false);
    expect(isPublicPhoneConfigured("+1-312-555-0198")).toBe(false);
    expect(isPublicPhoneConfigured("+86-138-0013-8000")).toBe(true);
    expect(getPublicContactPhone("+86-518-0000-0000")).toBeUndefined();
    expect(getPublicContactPhone("+1-312-555-0198")).toBeUndefined();
    expect(getPublicContactPhone("+86-138-0013-8000")).toBe(
      "+86-138-0013-8000",
    );
    expect(
      getPublicLogoPath({
        ...SINGLE_SITE_FACTS.brandAssets.logo,
        horizontal: "/logo.svg",
        status: "pending",
      }),
    ).toBeUndefined();
    expect(
      getPublicLogoPath({
        ...SINGLE_SITE_FACTS.brandAssets.logo,
        horizontal: "/logo.svg",
        status: "ready",
      }),
    ).toBe("/logo.svg");
  });
});
