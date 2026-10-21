import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttributionBootstrap } from "@/components/attribution-bootstrap";
import { shouldLoadAttribution } from "@/components/attribution-bootstrap-utils";

describe("AttributionBootstrap", () => {
  it("loads for UTM parameters and Google Ads click ids only", () => {
    expect(shouldLoadAttribution("?utm_source=google")).toBe(true);
    // Google Ads 自动标记的点击通常只带 gclid、不带 UTM。
    expect(shouldLoadAttribution("?gclid=Cj0KCQ")).toBe(true);
    expect(shouldLoadAttribution("?fbclid=unused")).toBe(false);
    expect(shouldLoadAttribution("")).toBe(false);
  });

  it("stores first-touch attribution when a UTM parameter is present", async () => {
    window.history.replaceState({}, "", "/?utm_source=google");
    render(<AttributionBootstrap />);

    await waitFor(() =>
      expect(
        JSON.parse(sessionStorage.getItem("inquiry_attribution") ?? "{}"),
      ).toMatchObject({ utmSource: "google" }),
    );
  });
});
