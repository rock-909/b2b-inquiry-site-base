import { notFound } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../../../messages/base/en/messages.json";
import es from "../../../../messages/base/es/messages.json";
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

vi.mock("@/config/single-site", () => ({
  SINGLE_SITE_CONFIG: mockSiteConfig,
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
      default: en.home.metadata.title,
      template: "%s | Test Site",
    });
    expect(metadata.description).toBe(en.home.metadata.description);
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

  it("localizes inherited Spanish metadata without publishing page URLs", async () => {
    const metadata = await generateLocaleMetadata({
      params: Promise.resolve({ locale: "es" }),
    });
    expect(metadata.title).toEqual({
      default: es.home.metadata.title,
      template: "%s | Test Site",
    });
    expect(metadata.description).toBe(es.home.metadata.description);
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph).toBeUndefined();
  });

  it("rejects an invalid locale through notFound", async () => {
    const notFoundError = new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    vi.mocked(notFound).mockImplementationOnce(() => {
      throw notFoundError;
    });

    await expect(
      generateLocaleMetadata({
        params: Promise.resolve({ locale: "invalid" }),
      }),
    ).rejects.toBe(notFoundError);
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
