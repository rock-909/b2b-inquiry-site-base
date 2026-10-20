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
  const GA_DISABLE_KEY = "ga-disable-G-TEST";

  function resetGaGlobals() {
    Reflect.deleteProperty(window, "dataLayer");
    Reflect.deleteProperty(window, "gtag");
    Reflect.deleteProperty(window, GA_DISABLE_KEY);
  }

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    resetGaGlobals();
  });

  afterEach(() => {
    window.history.replaceState(null, "", "/");
    resetGaGlobals();
  });

  it("does not load or initialize GA without consent", () => {
    render(<EnterpriseAnalyticsIsland analyticsAllowed={false} />);
    expect(screen.queryByTestId("ga")).toBeNull();
    // 同意前不得安装 gtag，也不得把 config/pageview 推入 dataLayer。
    expect(window.gtag).toBeUndefined();
    const dataLayer = (window.dataLayer ?? []) as unknown[][];
    expect(dataLayer.filter((args) => args[0] === "config")).toEqual([]);
  });

  it("sets the GA opt-out flag when consent is withdrawn", () => {
    const { rerender } = render(<EnterpriseAnalyticsIsland analyticsAllowed />);
    expect(Reflect.get(window, GA_DISABLE_KEY)).toBe(false);

    rerender(<EnterpriseAnalyticsIsland analyticsAllowed={false} />);
    expect(Reflect.get(window, GA_DISABLE_KEY)).toBe(true);
  });

  it("sends Consent Mode v2 signals on allow and on withdraw", () => {
    const allSignals = (value: "granted" | "denied") => ({
      analytics_storage: value,
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
    });
    const consentCommands = () =>
      (window.dataLayer as ArrayLike<unknown>[])
        .map((entry) => Array.from(entry))
        .filter((args) => args[0] === "consent");

    const { rerender } = render(<EnterpriseAnalyticsIsland analyticsAllowed />);
    // gtag.js 只处理 Arguments 对象，数组形式的命令会被静默丢弃。
    for (const entry of window.dataLayer) {
      expect(Object.prototype.toString.call(entry)).toBe("[object Arguments]");
    }
    expect(consentCommands()).toEqual([
      ["consent", "default", allSignals("denied")],
      ["consent", "update", allSignals("granted")],
    ]);

    rerender(<EnterpriseAnalyticsIsland analyticsAllowed={false} />);
    expect(consentCommands()).toEqual([
      ["consent", "default", allSignals("denied")],
      ["consent", "update", allSignals("granted")],
      ["consent", "update", allSignals("denied")],
    ]);
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
