import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoadConsent } = vi.hoisted(() => ({
  mockLoadConsent: vi.fn(),
}));

vi.mock("@/lib/cookie-consent/storage", () => ({
  loadConsent: mockLoadConsent,
}));

// Import after mocking
import {
  appendAttributionToFormData,
  captureClickIds,
  captureUtmParams,
  flushPendingAttribution,
  getAttributionAsObject,
  getAttributionSnapshot,
  storeAttributionData,
} from "@/lib/marketing/utm";

// Mock window and sessionStorage before importing the module
const mockSessionStorage = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => mockSessionStorage.store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockSessionStorage.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockSessionStorage.store[key];
  }),
  clear: vi.fn(() => {
    mockSessionStorage.store = {};
  }),
};

Object.defineProperty(global, "window", {
  value: {
    location: {
      search: "",
      pathname: "/test-page",
      href: "https://example.com/test-page",
    },
    sessionStorage: mockSessionStorage,
  },
  writable: true,
});

Object.defineProperty(global, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
});

function createStoredConsent(marketing: boolean) {
  return {
    consent: {
      necessary: true as const,
      analytics: false,
      marketing,
    },
    updatedAt: new Date().toISOString(),
    version: 1,
  };
}

describe("UTM Parameter Tracking", () => {
  beforeEach(() => {
    mockLoadConsent.mockReturnValue(createStoredConsent(true));
    flushPendingAttribution();
    mockSessionStorage.clear();
    mockSessionStorage.getItem.mockClear();
    mockSessionStorage.setItem.mockClear();
    vi.clearAllMocks();
    mockLoadConsent.mockReturnValue(createStoredConsent(true));
  });

  afterEach(() => {
    window.location.search = "";
  });

  describe("captureUtmParams", () => {
    it("should capture all UTM parameters from URL", () => {
      window.location.search =
        "?utm_source=google&utm_medium=cpc&utm_campaign=spring_sale&utm_term=shoes&utm_content=banner1";

      const params = captureUtmParams();

      expect(params).toEqual({
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "spring_sale",
        utmTerm: "shoes",
        utmContent: "banner1",
      });
    });

    it("should return empty object when no UTM params present", () => {
      window.location.search = "";

      const params = captureUtmParams();

      expect(params).toEqual({});
    });

    it("should capture partial UTM parameters", () => {
      window.location.search = "?utm_source=newsletter&utm_medium=email";

      const params = captureUtmParams();

      expect(params).toEqual({
        utmSource: "newsletter",
        utmMedium: "email",
      });
    });

    it("should sanitize invalid characters", () => {
      window.location.search =
        "?utm_source=valid_source-123&utm_medium=<script>";

      const params = captureUtmParams();

      expect(params).toEqual({
        utmSource: "valid_source-123",
      });
      expect(params.utmMedium).toBeUndefined();
    });

    it("should truncate long values", () => {
      const longValue = "a".repeat(300);
      window.location.search = `?utm_source=${longValue}`;

      const params = captureUtmParams();

      expect(params.utmSource?.length).toBeLessThanOrEqual(256);
    });

    it.each([
      "product-system",
      "brand_search",
      "product system",
      "brand+search",
      "google/cpc",
      "spring-2026",
    ])("should keep valid campaign value %s", (campaign) => {
      window.location.search = `?utm_campaign=${encodeURIComponent(campaign)}`;

      const params = captureUtmParams();

      expect(params.utmCampaign).toBe(campaign);
    });

    it.each([
      "<script>alert(1)</script>",
      'campaign"with"quotes',
      "campaign'with'single",
      "campaign\\with\\backslash",
      "campaign`with`backtick",
      "campaign\x00with\x00null",
    ])("rejects dangerous UTM value '%s'", (input) => {
      window.location.search = `?utm_campaign=${encodeURIComponent(input)}`;

      const result = captureUtmParams();

      expect(result.utmCampaign).toBeUndefined();
    });
  });

  describe("captureClickIds", () => {
    it("should capture Google click ID (gclid)", () => {
      window.location.search = "?gclid=abc123xyz";

      const ids = captureClickIds();

      expect(ids).toEqual({
        gclid: "abc123xyz",
      });
    });

    it("should capture Facebook click ID (fbclid)", () => {
      window.location.search = "?fbclid=fb_click_123";

      const ids = captureClickIds();

      expect(ids).toEqual({
        fbclid: "fb_click_123",
      });
    });

    it("should capture Microsoft click ID (msclkid)", () => {
      window.location.search = "?msclkid=ms_click_456";

      const ids = captureClickIds();

      expect(ids).toEqual({
        msclkid: "ms_click_456",
      });
    });

    it("should capture multiple click IDs", () => {
      window.location.search = "?gclid=g123&fbclid=f456";

      const ids = captureClickIds();

      expect(ids).toEqual({
        gclid: "g123",
        fbclid: "f456",
      });
    });

    it("should return empty object when no click IDs present", () => {
      window.location.search = "";

      const ids = captureClickIds();

      expect(ids).toEqual({});
    });
  });

  describe("storeAttributionData", () => {
    it("should store attribution data in sessionStorage", () => {
      window.location.search = "?utm_source=google&gclid=abc123";

      storeAttributionData();

      expect(mockSessionStorage.setItem).toHaveBeenCalled();
      const storedData = JSON.parse(
        mockSessionStorage.store["marketing_attribution"] as string,
      );
      expect(storedData.utmSource).toBe("google");
      expect(storedData.gclid).toBe("abc123");
      expect(storedData.landingPage).toBe("/test-page");
      expect(storedData.capturedAt).toBeDefined();
    });

    it("should not overwrite existing attribution data (first-touch)", () => {
      mockSessionStorage.store["marketing_attribution"] = JSON.stringify({
        utmSource: "original",
      });

      window.location.search = "?utm_source=new_source";

      storeAttributionData();

      const storedData = JSON.parse(
        mockSessionStorage.store["marketing_attribution"],
      );
      expect(storedData.utmSource).toBe("original");
    });

    it("should not store if no attribution data present", () => {
      window.location.search = "";

      storeAttributionData();

      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
    });

    it("should not write sessionStorage before marketing consent is granted", () => {
      mockLoadConsent.mockReturnValue(createStoredConsent(false));
      window.location.search = "?utm_source=google&gclid=abc123";

      storeAttributionData();

      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
      expect(mockSessionStorage.store["marketing_attribution"]).toBeUndefined();
    });

    it("should flush pending attribution after marketing consent is granted", async () => {
      mockLoadConsent.mockReturnValue(createStoredConsent(false));
      window.location.search = "?utm_source=google&gclid=abc123";

      storeAttributionData();
      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();

      mockLoadConsent.mockReturnValue(createStoredConsent(true));
      const utmModule = await import("@/lib/marketing/utm");
      const flushPendingAttribution = (
        utmModule as typeof utmModule & {
          flushPendingAttribution?: () => void;
        }
      ).flushPendingAttribution;

      expect(flushPendingAttribution).toBeTypeOf("function");

      flushPendingAttribution?.();

      expect(mockSessionStorage.setItem).toHaveBeenCalledTimes(1);
      const storedData = JSON.parse(
        mockSessionStorage.store["marketing_attribution"] as string,
      );
      expect(storedData.utmSource).toBe("google");
      expect(storedData.gclid).toBe("abc123");
    });
  });

  describe("getAttributionSnapshot", () => {
    it("should return stored attribution data", () => {
      mockSessionStorage.store["marketing_attribution"] = JSON.stringify({
        utmSource: "google",
        utmMedium: "cpc",
        gclid: "abc123",
      });

      const snapshot = getAttributionSnapshot();

      expect(snapshot).toEqual({
        utmSource: "google",
        utmMedium: "cpc",
        gclid: "abc123",
      });
    });

    it("should fallback to current URL params if no stored data", () => {
      window.location.search = "?utm_source=fallback&fbclid=fb123";

      const snapshot = getAttributionSnapshot();

      expect(snapshot.utmSource).toBe("fallback");
      expect(snapshot.fbclid).toBe("fb123");
    });

    it("should return pending attribution before consent without writing storage", () => {
      mockLoadConsent.mockReturnValue(createStoredConsent(false));
      window.location.search = "?utm_source=google&utm_medium=cpc";
      window.location.pathname = "/en/contact";

      storeAttributionData();
      window.location.search = "";
      window.location.pathname = "/en/request-quote";

      const snapshot = getAttributionSnapshot();

      expect(mockSessionStorage.setItem).not.toHaveBeenCalled();
      expect(snapshot).toMatchObject({
        utmSource: "google",
        utmMedium: "cpc",
        landingPage: "/en/contact",
      });
      expect(snapshot.capturedAt).toEqual(expect.any(String));
    });

    it("should return empty object if no data available", () => {
      window.location.search = "";

      const snapshot = getAttributionSnapshot();

      expect(snapshot).toEqual({});
    });

    it("should handle invalid JSON in sessionStorage gracefully", () => {
      mockSessionStorage.store["marketing_attribution"] = "invalid-json{";
      window.location.search = "?utm_source=fallback_source";

      const snapshot = getAttributionSnapshot();

      // Should fallback to URL params when JSON parse fails
      expect(snapshot.utmSource).toBe("fallback_source");
    });
  });

  describe("getAttributionAsObject", () => {
    it("should return attribution as plain object", () => {
      mockSessionStorage.store["marketing_attribution"] = JSON.stringify({
        utmSource: "google",
        utmMedium: "cpc",
        landingPage: "/test",
        capturedAt: "2024-01-01",
      });

      const obj = getAttributionAsObject();

      expect(obj).toEqual({
        utmSource: "google",
        utmMedium: "cpc",
        landingPage: "/test",
        capturedAt: "2024-01-01",
      });
    });
  });

  describe("appendAttributionToFormData", () => {
    it("should append attribution data to FormData", () => {
      mockSessionStorage.store["marketing_attribution"] = JSON.stringify({
        utmSource: "google",
        utmMedium: "cpc",
        gclid: "abc123",
      });

      const formData = new FormData();
      appendAttributionToFormData(formData);

      expect(formData.get("utmSource")).toBe("google");
      expect(formData.get("utmMedium")).toBe("cpc");
      expect(formData.get("gclid")).toBe("abc123");
    });

    it("should not append undefined values", () => {
      mockSessionStorage.store["marketing_attribution"] = JSON.stringify({
        utmSource: "google",
      });

      const formData = new FormData();
      appendAttributionToFormData(formData);

      expect(formData.get("utmSource")).toBe("google");
      expect(formData.get("utmMedium")).toBeNull();
    });

    it("should append all attribution fields when present", () => {
      mockSessionStorage.store["marketing_attribution"] = JSON.stringify({
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "spring_sale",
        utmTerm: "shoes",
        utmContent: "banner1",
        gclid: "g123",
        fbclid: "f456",
        msclkid: "m789",
        landingPage: "/test",
        capturedAt: "2024-01-01",
      });

      const formData = new FormData();
      appendAttributionToFormData(formData);

      expect(formData.get("utmSource")).toBe("google");
      expect(formData.get("utmMedium")).toBe("cpc");
      expect(formData.get("utmCampaign")).toBe("spring_sale");
      expect(formData.get("utmTerm")).toBe("shoes");
      expect(formData.get("utmContent")).toBe("banner1");
      expect(formData.get("gclid")).toBe("g123");
      expect(formData.get("fbclid")).toBe("f456");
      expect(formData.get("msclkid")).toBe("m789");
      expect(formData.get("landingPage")).toBe("/test");
      expect(formData.get("capturedAt")).toBe("2024-01-01");
    });
  });

  describe("getAttributionAsObject - complete coverage", () => {
    it("should return all attribution fields when present", () => {
      mockSessionStorage.store["marketing_attribution"] = JSON.stringify({
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "spring_sale",
        utmTerm: "shoes",
        utmContent: "banner1",
        gclid: "g123",
        fbclid: "f456",
        msclkid: "m789",
        landingPage: "/test",
        capturedAt: "2024-01-01",
      });

      const obj = getAttributionAsObject();

      expect(obj).toEqual({
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "spring_sale",
        utmTerm: "shoes",
        utmContent: "banner1",
        gclid: "g123",
        fbclid: "f456",
        msclkid: "m789",
        landingPage: "/test",
        capturedAt: "2024-01-01",
      });
    });

    it("should return empty object when no attribution data", () => {
      window.location.search = "";

      const obj = getAttributionAsObject();

      expect(obj).toEqual({});
    });
  });
});
