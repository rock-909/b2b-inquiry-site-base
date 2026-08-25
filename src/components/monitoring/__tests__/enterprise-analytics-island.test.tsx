import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnterpriseAnalyticsIsland } from "@/components/monitoring/enterprise-analytics-island";

const mockSearchParams = { current: new URLSearchParams() };
vi.mock("next/navigation", () => ({
  usePathname: () => "/contact",
  useSearchParams: () => mockSearchParams.current,
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
  it("S-F02: never reports query or hash in pageview URL", () => {
    mockSearchParams.current = new URLSearchParams("email=buyer%40example.com");
    window.dataLayer = [];
    render(<EnterpriseAnalyticsIsland analyticsAllowed />);

    const configCalls = (window.dataLayer as unknown[][]).filter(
      (args) => args[0] === "config",
    );
    expect(configCalls.length).toBeGreaterThan(0);

    // 真正产生 pageview 的调用（初始化那条带 send_page_view:false，不上报）。
    const pageviewCalls = configCalls.filter(
      (args) => (args[2] as Record<string, unknown>).send_page_view !== false,
    );
    expect(pageviewCalls.length).toBeGreaterThan(0);

    for (const args of pageviewCalls) {
      const params = args[2] as Record<string, string>;
      expect(params.page_path).toBe("/contact");
      expect(params.page_path).not.toContain("?");
      expect(params.page_location).toBe("http://localhost:3000/contact");
    }

    // 任何离开页面的字段都不得携带 query 内容。
    const serialized = JSON.stringify(window.dataLayer);
    expect(serialized).not.toContain("buyer%40example.com");
    expect(serialized).not.toContain("@example.com");
  });
});
