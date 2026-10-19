import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnterpriseAnalyticsIsland } from "@/components/monitoring/enterprise-analytics-island";

vi.mock("next/navigation", () => ({
  usePathname: () => "/contact",
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

  afterEach(() => {
    window.history.replaceState(null, "", "/");
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
    // 组件读 usePathname() 和 window.location，所以 query 必须放进真实的
    // jsdom URL，放进组件不读的 mock 证明不了任何事。
    window.history.replaceState(
      null,
      "",
      "/contact?email=buyer%40example.com#ref",
    );
    window.dataLayer = [];
    render(<EnterpriseAnalyticsIsland analyticsAllowed />);

    const configCalls = (window.dataLayer as unknown[][]).filter(
      (args) => args[0] === "config",
    );
    // 初始化那条带 send_page_view:false，不上报；其余才是 pageview。
    const pageviewCalls = configCalls.filter(
      (args) => (args[2] as Record<string, unknown>).send_page_view !== false,
    );
    expect(pageviewCalls.length).toBeGreaterThan(0);

    for (const args of pageviewCalls) {
      expect(args[2]).toMatchObject({
        page_path: "/contact",
        page_location: `${window.location.origin}/contact`,
      });
    }

    // 任何离开页面的字段都不得携带 query 或 hash 内容。
    const serialized = JSON.stringify(window.dataLayer);
    expect(serialized).not.toContain("buyer");
    expect(serialized).not.toContain("#ref");
  });
});
