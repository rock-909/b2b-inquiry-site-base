import { readFileSync } from "node:fs";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCookieConsentProvider,
  mockLazyCookieBanner,
  mockEnterpriseAnalyticsIsland,
  mockEnterpriseAnalyticsState,
} = vi.hoisted(() => {
  const mockEnterpriseAnalyticsState = { shouldThrow: false };

  return {
    mockCookieConsentProvider: vi.fn(({ children }) => (
      <div data-testid="cookie-consent-provider">{children}</div>
    )),
    mockLazyCookieBanner: vi.fn(() => <div data-testid="lazy-cookie-banner" />),
    mockEnterpriseAnalyticsState,
    mockEnterpriseAnalyticsIsland: vi.fn(() => {
      if (mockEnterpriseAnalyticsState.shouldThrow) {
        throw new Error("analytics island failed to load");
      }

      return <div data-testid="enterprise-analytics-island" />;
    }),
  };
});

vi.mock("@/lib/cookie-consent", () => ({
  CookieConsentProvider: mockCookieConsentProvider,
}));

vi.mock("@/components/cookie/lazy-cookie-banner", () => ({
  LazyCookieBanner: mockLazyCookieBanner,
}));

vi.mock("@/components/monitoring/enterprise-analytics-island", () => ({
  EnterpriseAnalyticsIsland: mockEnterpriseAnalyticsIsland,
}));

describe("CookieConsentIsland", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.unstubAllEnvs();
    mockEnterpriseAnalyticsState.shouldThrow = false;
  });

  it("keeps the consent island free of next/dynamic runtime", () => {
    const source = readFileSync(
      "src/components/cookie/cookie-consent-island.tsx",
      "utf8",
    );

    expect(source).not.toContain("next/dynamic");
  });

  it("renders CookieConsentProvider wrapping children", async () => {
    const { CookieConsentIsland } = await import("../cookie-consent-island");
    render(<CookieConsentIsland />);

    expect(screen.getByTestId("cookie-consent-provider")).toBeInTheDocument();
  });

  it("renders LazyCookieBanner inside Suspense", async () => {
    const { CookieConsentIsland } = await import("../cookie-consent-island");
    render(<CookieConsentIsland />);

    expect(screen.getByTestId("lazy-cookie-banner")).toBeInTheDocument();
  });

  it("renders EnterpriseAnalyticsIsland in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    const { CookieConsentIsland } = await import("../cookie-consent-island");
    render(<CookieConsentIsland />);

    expect(
      await screen.findByTestId("enterprise-analytics-island"),
    ).toBeInTheDocument();
  });

  it("does not render EnterpriseAnalyticsIsland in development", async () => {
    vi.stubEnv("NODE_ENV", "development");

    const { CookieConsentIsland } = await import("../cookie-consent-island");
    render(<CookieConsentIsland />);

    expect(
      screen.queryByTestId("enterprise-analytics-island"),
    ).not.toBeInTheDocument();
  });

  it("keeps the cookie banner usable when analytics island rendering fails", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockEnterpriseAnalyticsState.shouldThrow = true;
    const onCaughtError = vi.fn();
    const { CookieConsentIsland } = await import("../cookie-consent-island");
    render(<CookieConsentIsland />, { onCaughtError });

    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId("lazy-cookie-banner")).toBeInTheDocument();
    expect(
      screen.queryByTestId("enterprise-analytics-island"),
    ).not.toBeInTheDocument();
    expect(onCaughtError).toHaveBeenCalledTimes(1);
  });
});
