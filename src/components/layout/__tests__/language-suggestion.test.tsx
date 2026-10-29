/**
 * @vitest-environment jsdom
 */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsentController } from "@/components/cookie/cookie-consent-controller";
import { OPEN_CONSENT_EVENT } from "@/lib/cookie-consent/types";
import {
  LanguageSuggestion,
  type LanguageSuggestionCopy,
} from "@/components/layout/language-suggestion";
import type { ConfiguredLocale } from "@/config/paths/locales-config";
import { MobileLanguageSwitcher } from "@/components/layout/mobile-language-switcher";
import { PREFERRED_LOCALE_STORAGE_KEY } from "@/lib/i18n/preferred-locale";
import { DEFAULT_LOCALE, OTHER_LOCALE } from "@/test/two-locales";

vi.hoisted(() => vi.resetModules());
vi.mock("@/config/paths/locales-config", () => import("@/test/two-locales"));

vi.mock("@/i18n/routing", () => ({
  // 测试里只记录点击，不让 jsdom 真的跳转。
  FinalUrlLink: ({ onClick, ...props }: ComponentProps<"a">) => (
    <a
      {...props}
      onClick={(event) => {
        event.preventDefault();
        onClick?.(event);
      }}
    />
  ),
  usePathname: () => "/contact",
}));

vi.mock("@/components/cookie/cookie-banner", () => ({
  CookieBanner: ({ onReject }: { onReject: () => void }) => (
    <button type="button" onClick={onReject}>
      reject
    </button>
  ),
}));

vi.mock("@/components/monitoring/enterprise-analytics-island", () => ({
  EnterpriseAnalyticsIsland: () => null,
}));

// fixture 的 locale 联合与真实配置不同，在这里转换一次。
const COPY = {
  [DEFAULT_LOCALE]: {
    label: "Language suggestion",
    message: "This page is available in English.",
    switchAction: "Switch to English",
    dismiss: "Close",
  },
  [OTHER_LOCALE]: {
    label: "Sprachvorschlag",
    message: "Diese Seite gibt es auch auf Deutsch.",
    switchAction: "Zu Deutsch wechseln",
    dismiss: "Schließen",
  },
} as Record<ConfiguredLocale, LanguageSuggestionCopy>;

function setBrowserLanguages(languages: string[]) {
  vi.spyOn(window.navigator, "languages", "get").mockReturnValue(languages);
}

function addAlternate(hreflang: string) {
  const link = document.createElement("link");
  link.rel = "alternate";
  link.hreflang = hreflang;
  link.href = `https://example.com/${hreflang}`;
  document.head.append(link);
}

function renderSuggestion() {
  return render(<LanguageSuggestion locale={DEFAULT_LOCALE} copy={COPY} />);
}

describe("LanguageSuggestion", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.head.innerHTML = "";
    addAlternate("en");
    addAlternate("de");
    window.history.replaceState(
      {},
      "",
      "/contact?source=ad&tag=one&tag=two#inquiry",
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("suggests the first browser language the site has, in that language, keeping query and hash", async () => {
    setBrowserLanguages(["fr-FR", "de-AT", "en"]);
    renderSuggestion();

    const region = await screen.findByRole("region", {
      name: "Sprachvorschlag",
    });
    expect(region).toHaveAttribute("lang", "de");
    expect(region).toHaveTextContent("Diese Seite gibt es auch auf Deutsch.");
    expect(
      screen.getByRole("link", { name: "Zu Deutsch wechseln" }),
    ).toHaveAttribute("href", "/de/contact?source=ad&tag=one&tag=two#inquiry");
  });

  it("stays hidden when the browser language matches the page", async () => {
    setBrowserLanguages(["en-GB", "de"]);
    renderSuggestion();

    await Promise.resolve();
    expect(screen.queryByTestId("language-suggestion")).toBeNull();
  });

  it("stays hidden when the page has no version in the suggested language", async () => {
    document.head.innerHTML = "";
    setBrowserLanguages(["de"]);
    renderSuggestion();

    await Promise.resolve();
    expect(screen.queryByTestId("language-suggestion")).toBeNull();
  });

  it("closing remembers the current language so the prompt does not return", async () => {
    setBrowserLanguages(["de"]);
    const user = userEvent.setup();
    const { unmount } = renderSuggestion();

    await user.click(await screen.findByRole("button", { name: "Schließen" }));

    expect(screen.queryByTestId("language-suggestion")).toBeNull();
    expect(window.localStorage.getItem(PREFERRED_LOCALE_STORAGE_KEY)).toBe(
      "en",
    );

    unmount();
    renderSuggestion();
    await Promise.resolve();
    expect(screen.queryByTestId("language-suggestion")).toBeNull();
  });

  it("switching remembers the suggested language", async () => {
    setBrowserLanguages(["de"]);
    const user = userEvent.setup();
    renderSuggestion();

    await user.click(
      await screen.findByRole("link", { name: "Zu Deutsch wechseln" }),
    );

    expect(window.localStorage.getItem(PREFERRED_LOCALE_STORAGE_KEY)).toBe(
      "de",
    );
  });

  it("a remembered choice wins over the browser languages", async () => {
    window.localStorage.setItem(PREFERRED_LOCALE_STORAGE_KEY, "de");
    setBrowserLanguages(["en"]);
    renderSuggestion();

    expect(
      await screen.findByRole("region", { name: "Sprachvorschlag" }),
    ).toBeInTheDocument();
  });

  it("still works when browser storage throws", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    setBrowserLanguages(["de"]);
    const user = userEvent.setup();
    renderSuggestion();

    await user.click(await screen.findByRole("button", { name: "Schließen" }));
    await waitFor(() => {
      expect(screen.queryByTestId("language-suggestion")).toBeNull();
    });
  });

  it("appears after the cookie choice even when storage cannot save it, and hides again when settings reopen", async () => {
    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    setBrowserLanguages(["de"]);
    render(
      <>
        <CookieConsentController />
        <LanguageSuggestion locale={DEFAULT_LOCALE} copy={COPY} />
      </>,
    );

    const reject = await screen.findByRole("button", { name: "reject" });
    expect(screen.queryByTestId("language-suggestion")).toBeNull();

    fireEvent.click(reject);
    expect(
      await screen.findByRole("region", { name: "Sprachvorschlag" }),
    ).toBeInTheDocument();

    fireEvent(window, new Event(OPEN_CONSENT_EVENT));
    await waitFor(() => {
      expect(screen.queryByTestId("language-suggestion")).toBeNull();
    });
    expect(screen.getByRole("button", { name: "reject" })).toBeInTheDocument();
  });

  it("the language menu writes the same remembered choice", async () => {
    const user = userEvent.setup();
    render(<MobileLanguageSwitcher locale={DEFAULT_LOCALE} />);

    await user.click(screen.getByTestId("mobile-language-trigger"));
    await user.click(screen.getByRole("link", { name: "Deutsch" }));

    expect(window.localStorage.getItem(PREFERRED_LOCALE_STORAGE_KEY)).toBe(
      "de",
    );
  });
});
