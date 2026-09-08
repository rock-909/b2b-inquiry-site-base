import { render, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AttributionBootstrap } from "@/components/attribution-bootstrap";
import { shouldLoadAttribution } from "@/components/attribution-bootstrap-utils";

describe("AttributionBootstrap", () => {
  it("loads only for UTM parameters, not unconfigured click ids", () => {
    expect(shouldLoadAttribution("?utm_source=google")).toBe(true);
    expect(shouldLoadAttribution("?gclid=unused")).toBe(false);
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
