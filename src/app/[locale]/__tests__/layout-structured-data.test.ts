import { beforeEach, describe, expect, it, vi } from "vitest";
import { generatePageStructuredData } from "@/lib/page-structured-data";

const {
  mockGetTranslations,
  mockGenerateOrganizationData,
  mockGenerateWebSiteData,
} = vi.hoisted(() => ({
  mockGetTranslations: vi.fn(),
  mockGenerateOrganizationData: vi.fn(),
  mockGenerateWebSiteData: vi.fn(),
}));

vi.mock("next-intl/server", () => ({
  getTranslations: mockGetTranslations,
}));

vi.mock("@/lib/structured-data-generators", () => ({
  generateOrganizationData: mockGenerateOrganizationData,
  generateWebSiteData: mockGenerateWebSiteData,
}));

describe("Layout Structured Data Generation", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetTranslations.mockResolvedValue((key: string) => key);
    mockGenerateOrganizationData.mockReturnValue({
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "Tucsenberg",
      url: "https://example.com",
    });
    mockGenerateWebSiteData.mockReturnValue({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Tucsenberg",
      url: "https://example.com",
    });
  });

  it("requests structured-data translations for the requested locale", async () => {
    await generatePageStructuredData("en");

    expect(mockGetTranslations).toHaveBeenCalledWith({
      locale: "en",
      namespace: "structured-data",
    });
  });

  it("passes the translation function and empty config objects to both generators", async () => {
    await generatePageStructuredData("en");

    expect(mockGenerateOrganizationData).toHaveBeenCalledWith(
      expect.any(Function),
      {},
    );
    expect(mockGenerateWebSiteData).toHaveBeenCalledWith(
      expect.any(Function),
      {},
    );
  });

  it("returns the generated organization and website payloads", async () => {
    const result = await generatePageStructuredData("en");

    expect(result).toEqual({
      organizationData: {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Tucsenberg",
        url: "https://example.com",
      },
      websiteData: {
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Tucsenberg",
        url: "https://example.com",
      },
    });
  });

  it("forwards the translator to both generators", async () => {
    await generatePageStructuredData("en");

    const orgCall = mockGenerateOrganizationData.mock.calls[0];
    const siteCall = mockGenerateWebSiteData.mock.calls[0];
    const orgTranslator = orgCall![0] as (key: string) => string;
    const siteTranslator = siteCall![0] as (key: string) => string;

    expect(orgTranslator("organization.name")).toBe("organization.name");
    expect(siteTranslator("website.name")).toBe("website.name");
  });
});
