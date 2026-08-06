import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateLocaleMetadata } from "@/app/[locale]/layout-metadata";

const { mockSiteConfig } = vi.hoisted(() => ({
  mockSiteConfig: {
    name: "Test Site",
    seo: {
      titleTemplate: "%s | Test Site",
      defaultTitle: "Default Title",
      defaultDescription: "Default Description",
    },
  },
}));

vi.mock("@/config/paths", () => ({
  SITE_CONFIG: mockSiteConfig,
}));

describe("Locale layout metadata", () => {
  beforeEach(() => {
    process.env.GOOGLE_SITE_VERIFICATION = "google-verification-code";
    process.env.YANDEX_VERIFICATION = "yandex-verification-code";
  });

  afterEach(() => {
    delete process.env.GOOGLE_SITE_VERIFICATION;
    delete process.env.YANDEX_VERIFICATION;
    delete process.env.APP_ENV;
  });

  it("returns base metadata without alternates", async () => {
    process.env.APP_ENV = "production";
    const params = Promise.resolve({ locale: "en" });
    const metadata = await generateLocaleMetadata({ params });

    expect(metadata.title).toEqual({
      default: "Default Title",
      template: "%s | Test Site",
    });
    expect(metadata.description).toBe("Default Description");
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();

    expect(metadata.verification).toEqual({
      google: "google-verification-code",
      yandex: "yandex-verification-code",
    });

    const robots = metadata.robots as unknown as {
      googleBot?: { "max-video-preview"?: number };
    };
    expect(robots.googleBot?.["max-video-preview"]).toBe(-1);
  });

  it("falls back to default locale when locale is invalid", async () => {
    const params = Promise.resolve({ locale: "invalid" });
    const metadata = await generateLocaleMetadata({ params });

    expect(metadata.openGraph).toBeUndefined();
  });

  it("noindexes non-production layout metadata", async () => {
    process.env.APP_ENV = "preview";
    const params = Promise.resolve({ locale: "en" });
    const metadata = await generateLocaleMetadata({ params });

    expect(metadata.robots).toMatchObject({
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
      },
    });
  });
});
