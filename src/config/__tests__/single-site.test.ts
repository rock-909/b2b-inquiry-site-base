import { existsSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import { generateMetadataForPath } from "@/lib/seo-metadata";

const PREVIEW_BASE_URL =
  "https://tucsenberg-site-preview.faints-pudgier-9r.workers.dev";
const TUCSENBERG_OG_IMAGE = "/images/tucsenberg-og.png";

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

    expect(SINGLE_SITE_CONFIG.baseUrl).toBe(PREVIEW_BASE_URL);
  });

  it("keeps the approved Tucsenberg OG image as the live default", () => {
    expect(SINGLE_SITE_FACTS.brandAssets.ogImage).toBe(TUCSENBERG_OG_IMAGE);

    const metadata = generateMetadataForPath({
      locale: "en",
      pageType: "home",
      path: "/",
    });

    expect(metadata.openGraph?.images).toEqual([{ url: TUCSENBERG_OG_IMAGE }]);
    expect(metadata.twitter?.images).toEqual([TUCSENBERG_OG_IMAGE]);
  });

  it("only exposes certification files that exist in public", () => {
    const missingCertificationFiles = SINGLE_SITE_FACTS.certifications
      .flatMap((certification) =>
        certification.file
          ? [{ file: certification.file, name: certification.name }]
          : [],
      )
      .filter(({ file }) => {
        const publicRelativePath = file.replace(/^\//, "");
        const publicFilePath = path.resolve(
          process.cwd(),
          "public",
          publicRelativePath,
        );

        // eslint-disable-next-line security/detect-non-literal-fs-filename -- Certification paths come from SINGLE_SITE_FACTS and must be checked as declared.
        return !existsSync(publicFilePath);
      });

    expect(missingCertificationFiles).toEqual([]);
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
    expect(SINGLE_SITE_FACTS.brandAssets.logo.status).toBe("ready");
    expect(getPublicLogoPath(SINGLE_SITE_FACTS.brandAssets.logo)).toBe(
      "/images/tucsenberg-logo.png",
    );
    expect(SINGLE_SITE_FACTS.brandAssets.productPhotos.status).toBe("pending");
    // 从 establishedYear 减出来的值，买家在页面上看得见。算错方向就是负数。
    expect(SINGLE_SITE_FACTS.company.yearsInBusiness).toBeGreaterThan(0);
  });
});
