import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInquiryPayload } from "@/components/forms/inquiry-payload";
import { clearConsent, saveConsent } from "@/lib/cookie-consent/storage";
import { inquiryLeadSchema } from "@/lib/lead-pipeline/lead-schema";
import * as utm from "@/lib/marketing/utm";

const { captureUtmParams, getAttributionSnapshot, storeAttributionData } = utm;

function setAdvertisingConsent(advertising: boolean) {
  saveConsent({ necessary: true, analytics: advertising, advertising });
}

function readStoredAttribution(): Record<string, unknown> {
  return JSON.parse(sessionStorage.getItem("inquiry_attribution") ?? "{}");
}

function buyerPayload() {
  const formData = new FormData();
  formData.set("fullName", "Ana López");
  formData.set("email", "ana@example.com");
  return createInquiryPayload(formData, "token", "es");
}

// 询盘照常可提交：真实 lead schema 接受这份 payload。
function expectSubmittable(payload: ReturnType<typeof buyerPayload>) {
  expect(
    inquiryLeadSchema.safeParse({ type: "inquiry", ...payload }).success,
  ).toBe(true);
}

describe("UTM attribution", () => {
  it.each([
    "null",
    "[]",
    '{"utmSource":42}',
    '{"utmSource":{"private":"data"}}',
  ])(
    "does not let malformed optional storage block submission: %s",
    (stored) => {
      sessionStorage.setItem("inquiry_attribution", stored);
      expect(() =>
        createInquiryPayload(new FormData(), "token", "en"),
      ).not.toThrow();
      expect(getAttributionSnapshot()).toEqual({});
    },
  );
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    window.history.replaceState({}, "", "/");
  });

  it("captures sanitized UTM values and the Google Ads click id", () => {
    const longTerm = "a".repeat(300);
    window.history.replaceState(
      {},
      "",
      `/quote?utm_source=google&utm_campaign=promoci%C3%B3n%20a%C3%B1o&gclid=Cj0K-CQ_jw` +
        `&utm_medium=%3Cscript%3E&utm_content=ad%07copy&utm_term=${longTerm}`,
    );
    // 西语重音和 ñ 保留；HTML 分隔符和控制字符整项丢弃，超长值截到 256 字符。
    expect(captureUtmParams()).toEqual({
      utmSource: "google",
      utmCampaign: "promoción año",
      utmTerm: "a".repeat(256),
      gclid: "Cj0K-CQ_jw",
    });
  });

  it.each(
    ["gclid", "wbraid", "gbraid"].flatMap((param) =>
      ["abc%3Cdef", "a%20b", `${"a".repeat(257)}`].map((value) => [
        param,
        value,
      ]),
    ),
  )("drops a malformed or truncated-length %s: %s", (param, value) => {
    window.history.replaceState({}, "", `/?${param}=${value}`);
    expect(captureUtmParams()).toEqual({});
  });

  it("keeps the first touch across pages and sends it with the inquiry", () => {
    window.history.replaceState({}, "", "/landing?utm_source=google");
    storeAttributionData();
    window.history.replaceState({}, "", "/contact?utm_source=direct");
    storeAttributionData();

    const payload = createInquiryPayload(new FormData(), "token", "es");
    expect(payload.utmSource).toBe("google");
    expect(payload.landingPage).toBe("/landing");
    expect(payload.locale).toBe("es");
  });

  it("sends a gclid-only ad click with the inquiry", () => {
    setAdvertisingConsent(true);
    window.history.replaceState({}, "", "/es?gclid=Cj0KCQjw");
    storeAttributionData();
    window.history.replaceState({}, "", "/es/contact");

    const payload = createInquiryPayload(new FormData(), "token", "es");
    expect(payload.gclid).toBe("Cj0KCQjw");
    expect(payload.landingPage).toBe("/es");
  });

  it("sends an iOS ad click tagged with wbraid and gbraid with the inquiry", () => {
    setAdvertisingConsent(true);
    window.history.replaceState(
      {},
      "",
      "/es/contact?wbraid=test-w&gbraid=test-g",
    );
    storeAttributionData();

    const payload = createInquiryPayload(new FormData(), "token", "es");
    expect(payload.wbraid).toBe("test-w");
    expect(payload.gbraid).toBe("test-g");
    expect(payload.landingPage).toBe("/es/contact");
  });

  describe("Google Ads click ids follow the advertising consent", () => {
    const AD_LANDING = "/es?utm_source=google&utm_medium=cpc&gclid=Cj0KCQjw";

    function landFromAdThenOpenContact() {
      window.history.replaceState({}, "", AD_LANDING);
      storeAttributionData();
      window.history.replaceState({}, "", "/es/contact");
    }

    function expectSourceWithoutClickId() {
      const payload = buyerPayload();
      expect(payload).toMatchObject({
        utmSource: "google",
        utmMedium: "cpc",
        landingPage: "/es",
      });
      expect(payload.gclid).toBeUndefined();
      expect(readStoredAttribution()).not.toHaveProperty("gclid");
      expectSubmittable(payload);
    }

    it("keeps the source but not the click id before the buyer chooses", () => {
      landFromAdThenOpenContact();
      expectSourceWithoutClickId();
    });

    it("keeps the source but not the click id after the buyer rejects", () => {
      setAdvertisingConsent(false);
      landFromAdThenOpenContact();
      expectSourceWithoutClickId();
    });

    it("stores and sends the click id when advertising is allowed", () => {
      setAdvertisingConsent(true);
      landFromAdThenOpenContact();

      const payload = buyerPayload();
      expect(payload).toMatchObject({
        utmSource: "google",
        landingPage: "/es",
        gclid: "Cj0KCQjw",
      });
      expect(readStoredAttribution()).toMatchObject({ gclid: "Cj0KCQjw" });
      expectSubmittable(payload);
    });

    it("adds the click id held in page memory when the buyer allows advertising later", () => {
      landFromAdThenOpenContact();
      setAdvertisingConsent(true);
      utm.syncClickIdConsent();

      expect(readStoredAttribution()).toMatchObject({
        utmSource: "google",
        landingPage: "/es",
        gclid: "Cj0KCQjw",
      });
      const payload = buyerPayload();
      expect(payload.gclid).toBe("Cj0KCQjw");
      expectSubmittable(payload);
    });

    it("drops the held click id when the buyer rejects, even if they allow advertising afterwards", () => {
      landFromAdThenOpenContact();
      setAdvertisingConsent(false);
      utm.syncClickIdConsent();
      setAdvertisingConsent(true);
      utm.syncClickIdConsent();

      const payload = buyerPayload();
      expect(payload.utmSource).toBe("google");
      expect(payload.gclid).toBeUndefined();
      expect(readStoredAttribution()).not.toHaveProperty("gclid");
    });

    it("clears only the stored click id when the buyer withdraws consent", () => {
      setAdvertisingConsent(true);
      landFromAdThenOpenContact();
      clearConsent();
      utm.syncClickIdConsent();

      expect(readStoredAttribution()).toMatchObject({
        utmSource: "google",
        utmMedium: "cpc",
        landingPage: "/es",
      });
      expectSourceWithoutClickId();
    });

    it("never collects click ids on a site without GA, even with a stale consent record", () => {
      vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
      setAdvertisingConsent(true);
      landFromAdThenOpenContact();
      expectSourceWithoutClickId();
    });

    it.each([
      ["before the buyer chooses", () => undefined],
      ["after the buyer rejects", () => setAdvertisingConsent(false)],
      [
        "on a site without GA",
        () => {
          vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
          setAdvertisingConsent(true);
        },
      ],
    ])(
      "does not read a click id left in the stored record %s",
      (_state, arrange) => {
        sessionStorage.setItem(
          "inquiry_attribution",
          JSON.stringify({
            utmSource: "google",
            landingPage: "/es",
            gclid: "Cj0KCQjw",
          }),
        );
        arrange();

        const payload = buyerPayload();
        expect(payload).toMatchObject({
          utmSource: "google",
          landingPage: "/es",
        });
        expect(payload.gclid).toBeUndefined();
        expectSubmittable(payload);
      },
    );

    it("removes a click id left in storage on a site without GA, keeping the source and landing page", () => {
      vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
      sessionStorage.setItem(
        "inquiry_attribution",
        JSON.stringify({
          utmSource: "google",
          landingPage: "/es",
          gclid: "Cj0KCQjw",
          wbraid: "WbR-1",
          gbraid: "GbR-1",
        }),
      );

      getAttributionSnapshot();

      expect(readStoredAttribution()).toEqual({
        utmSource: "google",
        landingPage: "/es",
      });
    });

    it("removes a click id left in storage when a page loads without advertising consent", () => {
      setAdvertisingConsent(false);
      sessionStorage.setItem(
        "inquiry_attribution",
        JSON.stringify({
          utmSource: "google",
          landingPage: "/es",
          gclid: "Cj0KCQjw",
        }),
      );

      storeAttributionData();

      expect(readStoredAttribution()).toEqual({
        utmSource: "google",
        landingPage: "/es",
      });
    });

    it("drops the click id from the current-URL fallback without advertising consent", () => {
      setAdvertisingConsent(false);
      window.history.replaceState(
        {},
        "",
        `/es/contact?utm_source=google&gclid=Cj0KCQjw`,
      );

      expect(getAttributionSnapshot()).toEqual({ utmSource: "google" });
    });

    it("still submits the inquiry without the click id when the browser refuses storage writes", () => {
      setAdvertisingConsent(false);
      sessionStorage.setItem(
        "inquiry_attribution",
        JSON.stringify({ utmSource: "google", gclid: "Cj0KCQjw" }),
      );
      // 模拟配额满或隐私模式：浏览器拒绝任何存储写入。
      const setItem = vi
        .spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => {
          throw new DOMException("refused", "QuotaExceededError");
        });
      try {
        const payload = buyerPayload();
        expectSubmittable(payload);
        expect(payload).toMatchObject({ utmSource: "google" });
        expect(payload).not.toHaveProperty("gclid");
        expect(() => storeAttributionData()).not.toThrow();
      } finally {
        setItem.mockRestore();
      }
    });
  });
});
