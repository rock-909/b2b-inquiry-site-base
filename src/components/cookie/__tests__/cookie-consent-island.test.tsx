import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentIsland } from "@/components/cookie/cookie-consent-island";

vi.mock("@/components/cookie/cookie-banner", () => ({
  CookieBanner: ({ onAccept }: { onAccept: () => void }) => (
    <button type="button" onClick={onAccept}>
      allow
    </button>
  ),
}));

vi.mock("@/components/monitoring/enterprise-analytics-island", () => ({
  EnterpriseAnalyticsIsland: ({
    analyticsAllowed,
  }: {
    analyticsAllowed: boolean;
  }) => <div data-testid="analytics" data-allowed={String(analyticsAllowed)} />,
}));

describe("CookieConsentIsland", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "");
  });

  it("renders nothing when analytics is not configured", () => {
    const { container } = render(<CookieConsentIsland />);
    expect(container).toBeEmptyDOMElement();
  });

  it("asks once when GA is configured and enables analytics after acceptance", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    render(<CookieConsentIsland />);

    const allow = await screen.findByRole("button", { name: "allow" });
    expect(screen.getByTestId("analytics")).toHaveAttribute(
      "data-allowed",
      "false",
    );
    fireEvent.click(allow);
    expect(screen.queryByRole("button", { name: "allow" })).toBeNull();
    expect(screen.getByTestId("analytics")).toHaveAttribute(
      "data-allowed",
      "true",
    );
  });
});
