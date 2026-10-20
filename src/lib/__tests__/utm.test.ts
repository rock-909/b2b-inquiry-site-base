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
      expect(() => createInquiryPayload(new FormData(), "token")).not.toThrow();
      expect(getAttributionSnapshot()).toEqual({});
    },
  );
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("captures sanitized UTM values and ignores click ids", () => {
    const longTerm = "a".repeat(300);
    window.history.replaceState(
      {},
      "",
      `/quote?utm_source=google&utm_campaign=spring&gclid=unused` +
        `&utm_medium=%3Cscript%3E&utm_content=ad%07copy&utm_term=${longTerm}`,
    );
    // HTML 分隔符和控制字符整项丢弃，超长值截到 256 字符。
    expect(captureUtmParams()).toEqual({
      utmSource: "google",
      utmCampaign: "spring",
      utmTerm: "a".repeat(256),
    });
  });

  it("keeps the first touch across pages and sends it with the inquiry", () => {
    window.history.replaceState({}, "", "/landing?utm_source=google");
    storeAttributionData();
    window.history.replaceState({}, "", "/contact?utm_source=direct");
    storeAttributionData();

    const payload = createInquiryPayload(new FormData(), "token");
    expect(payload.utmSource).toBe("google");
    expect(payload.landingPage).toBe("/landing");
    expect(payload).not.toHaveProperty("gclid");
  });
});
