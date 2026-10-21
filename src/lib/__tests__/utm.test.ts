import { beforeEach, describe, expect, it } from "vitest";
import { createInquiryPayload } from "@/components/forms/inquiry-payload";
import {
  captureUtmParams,
  getAttributionSnapshot,
  storeAttributionData,
} from "@/lib/marketing/utm";

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
    window.history.replaceState({}, "", "/es?gclid=Cj0KCQjw");
    storeAttributionData();
    window.history.replaceState({}, "", "/es/contact");

    const payload = createInquiryPayload(new FormData(), "token", "es");
    expect(payload.gclid).toBe("Cj0KCQjw");
    expect(payload.landingPage).toBe("/es");
  });

  it("sends an iOS ad click tagged with wbraid and gbraid with the inquiry", () => {
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
});
