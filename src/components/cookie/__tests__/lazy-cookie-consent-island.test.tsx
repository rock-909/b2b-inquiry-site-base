import { readFileSync } from "node:fs";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { IDLE_CALLBACK_TIMEOUT_LONG } from "@/constants/time";

const {
  idleCallbacks,
  mockCookieConsentIsland,
  mockRequestIdleCallback,
  mockCleanupIdleCallback,
} = vi.hoisted(() => ({
  idleCallbacks: [] as Array<() => void>,
  mockCookieConsentIsland: vi.fn(() => (
    <div data-testid="cookie-consent-island" />
  )),
  mockRequestIdleCallback: vi.fn((callback: () => void) => {
    idleCallbacks.push(callback);
    return mockCleanupIdleCallback;
  }),
  mockCleanupIdleCallback: vi.fn(),
}));

vi.mock("@/lib/idle-callback", () => ({
  requestIdleCallback: mockRequestIdleCallback,
}));

vi.mock("@/components/cookie/cookie-consent-island", () => ({
  CookieConsentIsland: mockCookieConsentIsland,
}));

describe("LazyCookieConsentIsland", () => {
  beforeEach(() => {
    idleCallbacks.length = 0;
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("keeps the first-page cookie island free of next/dynamic runtime", () => {
    const source = readFileSync(
      "src/components/cookie/lazy-cookie-consent-island.tsx",
      "utf8",
    );

    expect(source).not.toContain("next/dynamic");
  });

  it("returns null before the shared idle callback fires", async () => {
    const { LazyCookieConsentIsland } =
      await import("../lazy-cookie-consent-island");
    const { container } = render(<LazyCookieConsentIsland />);

    expect(container.firstChild).toBeNull();
    expect(mockCookieConsentIsland).not.toHaveBeenCalled();
    expect(mockRequestIdleCallback).toHaveBeenCalledWith(expect.any(Function), {
      fallbackDelay: IDLE_CALLBACK_TIMEOUT_LONG,
      timeout: IDLE_CALLBACK_TIMEOUT_LONG,
    });
  });

  it("renders CookieConsentIsland when the shared idle callback fires", async () => {
    const { LazyCookieConsentIsland } =
      await import("../lazy-cookie-consent-island");
    render(<LazyCookieConsentIsland />);

    await act(async () => {
      idleCallbacks[0]?.();
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId("cookie-consent-island")).toBeInTheDocument();
    expect(mockCookieConsentIsland).toHaveBeenCalled();
  });

  it("cancels the shared idle callback when unmounted before render", async () => {
    const { LazyCookieConsentIsland } =
      await import("../lazy-cookie-consent-island");
    const { unmount } = render(<LazyCookieConsentIsland />);

    unmount();

    expect(mockCleanupIdleCallback).toHaveBeenCalledTimes(1);
  });
});
