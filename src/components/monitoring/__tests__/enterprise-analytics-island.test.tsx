import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnterpriseAnalyticsIsland } from "@/components/monitoring/enterprise-analytics-island";

vi.mock("next/navigation", () => ({
  usePathname: () => "/contact",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("next/script", () => ({
  default: ({ src }: { src: string }) => (
    <span data-testid="ga" data-src={src} />
  ),
}));

describe("EnterpriseAnalyticsIsland", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
  });

  it("does not load GA without consent", () => {
    render(<EnterpriseAnalyticsIsland analyticsAllowed={false} />);
    expect(screen.queryByTestId("ga")).toBeNull();
  });

  it("loads configured GA after consent", () => {
    render(<EnterpriseAnalyticsIsland analyticsAllowed />);
    expect(screen.getByTestId("ga")).toHaveAttribute(
      "data-src",
      "https://www.googletagmanager.com/gtag/js?id=G-TEST",
    );
  });
});
