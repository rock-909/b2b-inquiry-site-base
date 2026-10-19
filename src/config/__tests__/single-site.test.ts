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
    const REFERENCE_OG_IMAGE = SINGLE_SITE_FACTS.brandAssets.ogImage;
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

    expect(getPublicContactEmail("not-an-email")).toBeUndefined();
    expect(getPublicContactPhone("call me")).toBeUndefined();
    expect(getPublicContactPhone("-------")).toBeUndefined();
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
        width: 240,
        height: 72,
        horizontal: "/logo.svg",
        status: "pending",
      }),
    ).toBeUndefined();
    expect(
      getPublicLogoPath({
        width: 240,
        height: 72,
        horizontal: "/logo.svg",
        status: "ready",
      }),
    ).toBe("/logo.svg");
  });
  it("accepts real names and profiles containing Northstar or Todo", async () => {
    const { getPublicFact, getPublicSocialUrl } =
      await import("@/config/public-trust");
    for (const name of [
      "Northstar Manufacturing",
      "Todo Industries",
      "Todo-Industries",
      "Todorov Engineering",
    ])
      expect(getPublicFact(name)).toBe(name);
    for (const url of [
      "https://linkedin.com/company/northstar-manufacturing",
      "https://linkedin.com/company/todo-industries",
      "https://todo.com/profile",
    ])
      expect(getPublicSocialUrl(url)).toBe(url);
  });

  it("still rejects known sentinel names and explicit TODO markers", async () => {
    const { getPublicFact, getPublicSocialUrl } =
      await import("@/config/public-trust");
    for (const value of [
      "Northstar Industrial Reference",
      "B2B Inquiry Template",
      "Replace before launch",
      "TODO",
      "TODO-OWNER",
      "TODO: company name",
      "[TODO]",
    ])
      expect(getPublicFact(value)).toBeUndefined();
    expect(getPublicSocialUrl("https://x.com/example")).toBeUndefined();
  });

  it("accepts local logos but rejects paths that resolve across origins", async () => {
    const { getPublicLogoPath } = await import("@/config/public-trust");
    const logo = { status: "ready" as const, width: 240, height: 72 };
    expect(getPublicLogoPath({ ...logo, horizontal: "/images/logo.svg" })).toBe(
      "/images/logo.svg",
    );
    for (const horizontal of [
      String.raw`/\cdn.invalid/logo.svg`,
      "//cdn.invalid/logo.svg",
      "https://cdn.invalid/logo.svg",
      String.raw`/images\logo.svg`,
    ])
      expect(getPublicLogoPath({ ...logo, horizontal })).toBeUndefined();
  });
});
