import { beforeEach, describe, expect, it } from "vitest";
import {
  appendAttributionToFormData,
  captureUtmParams,
  storeAttributionData,
} from "@/lib/marketing/utm";

describe("UTM attribution", () => {
  beforeEach(() => {
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("captures sanitized UTM values and ignores click ids", () => {
    window.history.replaceState(
      {},
      "",
      "/quote?utm_source=google&utm_campaign=spring&gclid=unused",
    );
    expect(captureUtmParams()).toEqual({
      utmSource: "google",
      utmCampaign: "spring",
    });
  });

  it("keeps the first touch across pages and appends it to the inquiry", () => {
    window.history.replaceState({}, "", "/landing?utm_source=google");
    storeAttributionData();
    window.history.replaceState({}, "", "/contact?utm_source=direct");
    storeAttributionData();

    const formData = new FormData();
    appendAttributionToFormData(formData);
    expect(formData.get("utmSource")).toBe("google");
    expect(formData.get("landingPage")).toBe("/landing");
    expect(formData.get("gclid")).toBeNull();
  });
});
