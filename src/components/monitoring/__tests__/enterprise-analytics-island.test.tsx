import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CONSENT,
  type CookieConsentContextValue,
} from "@/lib/cookie-consent/types";

const { mockUseLocale, mockUseCookieConsentOptional } = vi.hoisted(() => ({
  mockUseLocale: vi.fn(() => "en"),
  mockUseCookieConsentOptional: vi.fn<() => CookieConsentContextValue | null>(),
}));

vi.mock("next-intl", () => ({
  useLocale: mockUseLocale,
}));

vi.mock("@/lib/cookie-consent", () => ({
  useCookieConsentOptional: mockUseCookieConsentOptional,
}));

const { mockLogger } = vi.hoisted(() => ({
  mockLogger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: mockLogger,
}));

vi.mock("web-vitals", () => ({
  onCLS: vi.fn(),
  onFCP: vi.fn(),
  onLCP: vi.fn(),
  onTTFB: vi.fn(),
  onINP: vi.fn(),
}));

vi.mock("next/script", () => ({
  default: () => null,
}));

function createCookieConsentValue(
  overrides: Partial<Pick<CookieConsentContextValue, "ready" | "consent">> = {},
): CookieConsentContextValue {
  return {
    consent: overrides.consent ?? DEFAULT_CONSENT,
    hasConsented: true,
    ready: overrides.ready ?? true,
    acceptAll: vi.fn(),
    rejectAll: vi.fn(),
    updateConsent: vi.fn(),
    savePreferences: vi.fn(),
    resetConsent: vi.fn(),
  };
}

describe("EnterpriseAnalyticsIsland", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    // Reset window.dataLayer and window.gtag
    delete (window as unknown as Record<string, unknown>).dataLayer;
    delete (window as unknown as Record<string, unknown>).gtag;
  });

  it("keeps analytics integrations free of next/dynamic runtime", () => {
    const source = readFileSync(
      "src/components/monitoring/enterprise-analytics-island.tsx",
      "utf8",
    );

    expect(source).not.toContain("next/dynamic");
  });

  it("renders nothing when consent system exists but is not ready", async () => {
    mockUseCookieConsentOptional.mockReturnValue(
      createCookieConsentValue({ ready: false }),
    );

    const { EnterpriseAnalyticsIsland } =
      await import("../enterprise-analytics-island");
    const { container } = render(<EnterpriseAnalyticsIsland />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("analytics")).not.toBeInTheDocument();
  });

  it("does not import platform-specific analytics packages in production", async () => {
    mockUseCookieConsentOptional.mockReturnValue(null);
    vi.stubEnv("NODE_ENV", "production");

    const { EnterpriseAnalyticsIsland } =
      await import("../enterprise-analytics-island");
    const { container } = render(<EnterpriseAnalyticsIsland />);

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("analytics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("speed-insights")).not.toBeInTheDocument();
  });

  it("initializes GA4 dataLayer and gtag when enabled in production", async () => {
    mockUseCookieConsentOptional.mockReturnValue(
      createCookieConsentValue({
        ready: true,
        consent: { ...DEFAULT_CONSENT, analytics: true },
      }),
    );
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST123");

    const { EnterpriseAnalyticsIsland } =
      await import("../enterprise-analytics-island");
    render(<EnterpriseAnalyticsIsland />);

    // GA4 initialization should set up dataLayer
    expect(window.dataLayer).toBeDefined();
    expect(Array.isArray(window.dataLayer)).toBe(true);
    expect(typeof window.gtag).toBe("function");
  });

  it("renders nothing when analytics consent is denied", async () => {
    mockUseCookieConsentOptional.mockReturnValue(
      createCookieConsentValue({
        ready: true,
        consent: { ...DEFAULT_CONSENT, analytics: false },
      }),
    );

    const { EnterpriseAnalyticsIsland } =
      await import("../enterprise-analytics-island");
    const { container } = render(<EnterpriseAnalyticsIsland />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("resolveAnalyticsAllowed", () => {
  it("denies analytics when the consent context is absent", async () => {
    const { resolveAnalyticsAllowed } = await import("../analytics-consent");

    expect(resolveAnalyticsAllowed(null)).toBe(false);
  });

  it("denies analytics while consent is not ready", async () => {
    const { resolveAnalyticsAllowed } = await import("../analytics-consent");

    expect(
      resolveAnalyticsAllowed({ ready: false, consent: DEFAULT_CONSENT }),
    ).toBe(false);
  });

  it("allows analytics when consent is ready and granted", async () => {
    const { resolveAnalyticsAllowed } = await import("../analytics-consent");

    expect(
      resolveAnalyticsAllowed({
        ready: true,
        consent: { ...DEFAULT_CONSENT, analytics: true },
      }),
    ).toBe(true);
  });

  it("denies analytics when consent is ready but declined", async () => {
    const { resolveAnalyticsAllowed } = await import("../analytics-consent");

    expect(
      resolveAnalyticsAllowed({
        ready: true,
        consent: { ...DEFAULT_CONSENT, analytics: false },
      }),
    ).toBe(false);
  });
});
