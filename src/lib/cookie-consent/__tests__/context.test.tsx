import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CONSENT,
  type CookieConsent,
} from "@/lib/cookie-consent/types";

const {
  mockLoadConsent,
  mockSaveConsent,
  mockClearConsent,
  mockCreateAcceptAllConsent,
  mockCreateRejectAllConsent,
} = vi.hoisted(() => ({
  mockLoadConsent: vi.fn(),
  mockSaveConsent: vi.fn(),
  mockClearConsent: vi.fn(),
  mockCreateAcceptAllConsent: vi.fn(),
  mockCreateRejectAllConsent: vi.fn(),
}));

vi.mock("@/lib/cookie-consent/storage", () => ({
  loadConsent: mockLoadConsent,
  saveConsent: mockSaveConsent,
  clearConsent: mockClearConsent,
  createAcceptAllConsent: mockCreateAcceptAllConsent,
  createRejectAllConsent: mockCreateRejectAllConsent,
}));

async function flushMicrotasks() {
  await new Promise<void>((resolve) => {
    queueMicrotask(() => resolve());
  });
}

describe("CookieConsentProvider (hydration-safe external store)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mockCreateAcceptAllConsent.mockReturnValue({
      necessary: true,
      analytics: true,
      marketing: true,
    } satisfies CookieConsent);
    mockCreateRejectAllConsent.mockReturnValue(DEFAULT_CONSENT);
  });

  it("starts with server snapshot and becomes ready after microtask", async () => {
    mockLoadConsent.mockReturnValue(null);
    const { CookieConsentProvider, useCookieConsent } =
      await import("../context");

    function Consumer() {
      const state = useCookieConsent();
      return (
        <div>
          <div data-testid="ready">{String(state.ready)}</div>
          <div data-testid="hasConsented">{String(state.hasConsented)}</div>
        </div>
      );
    }

    render(
      <CookieConsentProvider>
        <Consumer />
      </CookieConsentProvider>,
    );

    expect(screen.getByTestId("ready")).toHaveTextContent("false");
    expect(screen.getByTestId("hasConsented")).toHaveTextContent("false");

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.getByTestId("ready")).toHaveTextContent("true");
    expect(screen.getByTestId("hasConsented")).toHaveTextContent("false");
  });

  it("loads stored consent on first subscription and marks ready after microtask", async () => {
    mockLoadConsent.mockReturnValue({
      consent: {
        necessary: true,
        analytics: true,
        marketing: false,
      },
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    const { CookieConsentProvider, useCookieConsent } =
      await import("../context");

    function Consumer() {
      const state = useCookieConsent();
      return (
        <div>
          <div data-testid="ready">{String(state.ready)}</div>
          <div data-testid="analytics">{String(state.consent.analytics)}</div>
          <div data-testid="hasConsented">{String(state.hasConsented)}</div>
        </div>
      );
    }

    render(
      <CookieConsentProvider>
        <Consumer />
      </CookieConsentProvider>,
    );

    expect(screen.getByTestId("ready")).toHaveTextContent("false");

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.getByTestId("ready")).toHaveTextContent("true");
    expect(screen.getByTestId("hasConsented")).toHaveTextContent("true");
    expect(screen.getByTestId("analytics")).toHaveTextContent("true");
  });

  it("acceptAll updates store and persists consent", async () => {
    mockLoadConsent.mockReturnValue(null);
    const { CookieConsentProvider, useCookieConsent } =
      await import("../context");

    function Consumer() {
      const state = useCookieConsent();
      return (
        <div>
          <button type="button" onClick={() => state.acceptAll()}>
            accept
          </button>
          <div data-testid="ready">{String(state.ready)}</div>
          <div data-testid="analytics">{String(state.consent.analytics)}</div>
        </div>
      );
    }

    render(
      <CookieConsentProvider>
        <Consumer />
      </CookieConsentProvider>,
    );

    await act(async () => {
      await flushMicrotasks();
    });

    expect(screen.getByTestId("ready")).toHaveTextContent("true");

    await act(async () => {
      screen.getByRole("button", { name: "accept" }).click();
    });

    expect(mockSaveConsent).toHaveBeenCalledWith(
      expect.objectContaining({ analytics: true, marketing: true }),
    );
    expect(screen.getByTestId("analytics")).toHaveTextContent("true");
  });
});
