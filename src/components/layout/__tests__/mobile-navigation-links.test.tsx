/**
 * @vitest-environment jsdom
 */

/**
 * MobileNavigationLinks — server-rendered / no-JS link list.
 *
 * This is the sole owner of proofs about the *content* of the mobile link
 * list: the no-JS SSR fallback, the contact CTA, active-path
 * highlighting, and the exact item set/order. Drawer interaction (opening,
 * closing, keyboard) and the toggle button live in mobile-navigation.test.tsx.
 */

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslations } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_NAVIGATION } from "@/config/single-site-navigation";
import { MobileNavigationLinks } from "@/components/layout/mobile-navigation";
import { getFlatMessages, lookupMessage } from "@/test/i18n-messages";
import { createMockUseTranslations } from "@/test/utils";

type MockLinkHref =
  string | { pathname: string; query?: Record<string, string> };

function stringifyMockHref(href: MockLinkHref): string {
  if (typeof href === "string") {
    return href;
  }

  const query =
    href.query === undefined ? "" : `?${new URLSearchParams(href.query)}`;

  return `${href.pathname}${query}`;
}

vi.mock("next-intl", () => ({
  useTranslations: vi.fn(),
  useLocale: vi.fn(() => "en"),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, className, prefetch: _prefetch, ...props }: any) => (
    <a href={stringifyMockHref(href)} className={className} {...props}>
      {children}
    </a>
  ),
}));

const messages = getFlatMessages();
const EXPECTED_ITEM_LABELS = SINGLE_SITE_NAVIGATION.map((item) =>
  lookupMessage(messages, `navigation.${item.messageKey}`),
);
const CTA_LABEL = lookupMessage(messages, "navigation.contactSales");

describe("MobileNavigationLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
      createMockUseTranslations(),
    );
  });

  it("renders a server-safe link list for the no-JS fallback", () => {
    // renderToStaticMarkup proves the list works with no client runtime and
    // exposes no interactive drawer state (aria-expanded lives on the button).
    const html = renderToStaticMarkup(<MobileNavigationLinks />);

    expect(html).toContain("Home");
    expect(html).toContain("Start an inquiry");
    expect(html).toContain('href="/"');
    expect(html).not.toContain("aria-expanded");
  });

  it("uses the accessibility mobile navigation label on the nav landmark", () => {
    (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
      createMockUseTranslations({
        "accessibility.mobileNavigation": "TEST mobile nav landmark",
      }),
    );

    render(<MobileNavigationLinks />);

    expect(
      screen.getByRole("navigation", { name: "TEST mobile nav landmark" }),
    ).toBeInTheDocument();
  });

  it("renders every navigation item plus the CTA in order", () => {
    render(<MobileNavigationLinks />);

    const linkTexts = screen
      .getAllByRole("link")
      .map((link) => link.textContent?.trim());

    expect(linkTexts).toEqual([...EXPECTED_ITEM_LABELS, CTA_LABEL]);
    expect(screen.getAllByRole("link")[0]).toHaveAttribute("href", "/");
    // The link list is exactly the nav items plus a single contact CTA.
    expect(screen.getAllByRole("link")).toHaveLength(
      SINGLE_SITE_NAVIGATION.length + 1,
    );
    // "Contact" is only ever the CTA, never a standalone nav item.
    expect(screen.queryByRole("link", { name: "Contact" })).toBeNull();
  });

  it("points the CTA at the inquiry form", () => {
    render(<MobileNavigationLinks />);

    expect(
      screen.getAllByRole("link", { name: CTA_LABEL }).at(-1),
    ).toHaveAttribute("href", "/contact");
  });

  it("marks the active item with aria-current and leaves others unset", () => {
    render(<MobileNavigationLinks currentPathname="/" />);

    expect(
      screen.getByRole("link", { name: "Home", current: "page" }),
    ).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: CTA_LABEL })).not.toHaveAttribute(
      "aria-current",
    );
  });
});
