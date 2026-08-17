import { afterEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_CONFIG, SINGLE_SITE_FACTS } from "@/config/single-site";

afterEach(() => {
  vi.useRealTimers();
  vi.resetModules();
});

describe("site message values", () => {
  it("derives the footer year from the build-time UTC clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-06-15T00:00:00.000Z"));

    const { getSiteMessageValues } =
      await import("@/lib/i18n/site-message-values");

    const values = await getSiteMessageValues();

    expect(values).toEqual({
      siteName: SINGLE_SITE_CONFIG.name,
      companyName: SINGLE_SITE_FACTS.company.name,
      currentYear: "2030",
    });
  });
});
