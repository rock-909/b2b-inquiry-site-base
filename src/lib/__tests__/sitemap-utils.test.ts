/**
 * Sitemap utilities tests
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStaticPageLastModified } from "../sitemap-utils";

describe("sitemap-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getStaticPageLastModified", () => {
    it("should return configured date for known path", () => {
      const config = new Map([
        ["/about", new Date("2023-01-15T00:00:00Z")],
        ["/contact", new Date("2023-02-20T00:00:00Z")],
      ]);

      const result = getStaticPageLastModified("/about", config);

      expect(result.toISOString()).toBe("2023-01-15T00:00:00.000Z");
    });

    it("should not return fake now for unknown path", () => {
      const config = new Map([["/about", new Date("2023-01-15T00:00:00Z")]]);

      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-04-26T00:00:00Z"));

      try {
        const result = getStaticPageLastModified("/unknown", config);

        expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
        expect(result.toISOString()).not.toBe("2026-04-26T00:00:00.000Z");
      } finally {
        vi.useRealTimers();
      }
    });

    it("should return conservative fixed date when config is undefined", () => {
      const result = getStaticPageLastModified("/about");

      expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("should return conservative fixed date when config is empty", () => {
      const result = getStaticPageLastModified("/about", new Map());

      expect(result.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });
  });
});
