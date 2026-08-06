/**
 * @vitest-environment jsdom
 */

/**
 * MobileNavigationLinks — server-rendered / no-JS link list.
 *
 * This is the sole owner of proofs about the *content* of the mobile link
 * list: the no-JS SSR fallback, the conditional contact CTA, active-path
 * highlighting, and the exact item set/order. Drawer interaction (opening,
 * closing, keyboard) lives in mobile-navigation.test.tsx; the standalone
 * toggle button lives in mobile-menu-button.test.tsx.
 */

import { render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { useTranslations } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mobileNavigation } from "@/lib/navigation";
import { MobileNavigationLinks } from "@/components/layout/mobile-navigation";
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

interface MockHomeLinkTargets {
  primaryCta: string;
  secondaryCta: string;
  contact?: string;
  requestQuote?: string;
}

// Mutable link-target source so the CTA-omission branch can be exercised.
const mockHomeLinkTargets = vi.hoisted(
  (): { current: MockHomeLinkTargets } => ({
    current: {
      contact: "/contact",
      requestQuote: "/request-quote",
      primaryCta: "/request-quote",
      secondaryCta: "/oem-wholesale",
    },
  }),
);

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

vi.mock("@/config/single-site-links", async (importOriginal) => {
  // Keep the real route-href table (the navigation config needs it at load);
  // only the home-link CTA targets are made overridable per test.
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    get SINGLE_SITE_HOME_LINK_TARGETS() {
      return mockHomeLinkTargets.current;
    },
  };
});

const EXPECTED_ITEM_LABELS = [
  "Home",
  "Products",
  "OEM & Wholesale",
  "Guides",
  "About",
] as const;
const CTA_LABEL = "Request a Quote";

describe("MobileNavigationLinks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
      createMockUseTranslations(),
    );
    mockHomeLinkTargets.current = {
      contact: "/contact",
      requestQuote: "/request-quote",
      primaryCta: "/request-quote",
      secondaryCta: "/oem-wholesale",
    };
  });

  it("renders a server-safe link list for the no-JS fallback", () => {
    // renderToStaticMarkup proves the list works with no client runtime and
    // exposes no interactive drawer state (aria-expanded lives on the button).
    const html = renderToStaticMarkup(<MobileNavigationLinks />);

    expect(html).toContain("Home");
    expect(html).toContain("About");
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
    // The link list is exactly the nav items plus a single contact CTA.
    expect(screen.getAllByRole("link")).toHaveLength(
      mobileNavigation.length + 1,
    );
    // "Contact" is only ever the CTA, never a standalone nav item.
    expect(screen.queryByRole("link", { name: "Contact" })).toBeNull();
  });

  it("points the CTA at the quote route with the mobile-nav source tag", () => {
    render(<MobileNavigationLinks />);

    expect(screen.getByRole("link", { name: CTA_LABEL })).toHaveAttribute(
      "href",
      "/request-quote?source=mobile_nav_cta",
    );
  });

  it("omits the drawer CTA when the active profile has no contact route", () => {
    mockHomeLinkTargets.current = { primaryCta: "/", secondaryCta: "/" };

    const html = renderToStaticMarkup(
      <MobileNavigationLinks contactSalesLabel="Contact sales" />,
    );

    expect(html).not.toContain("mobile_nav_cta");
    expect(html).not.toContain("Contact sales");
  });

  it("marks the active item with aria-current and leaves others unset", () => {
    render(<MobileNavigationLinks currentPathname="/about" />);

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("applies the shared item styling to nav links", () => {
    render(<MobileNavigationLinks />);

    const navLinks = screen
      .getAllByRole("link")
      .filter((link) => link.className.includes("rounded-md px-3 py-2"));

    expect(navLinks).toHaveLength(mobileNavigation.length);
    for (const link of navLinks) {
      expect(link).toHaveClass(
        "flex",
        "items-center",
        "rounded-md",
        "px-3",
        "py-2",
      );
    }
  });
});
