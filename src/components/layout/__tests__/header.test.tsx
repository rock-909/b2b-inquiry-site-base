/**
 * Header Component Tests
 *
 * Tests for the async Server Component Header using a render helper
 * that awaits the component before passing to React Testing Library.
 */
import { cloneElement, isValidElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/layout/header";

interface MockHomeLinkTargets {
  primaryCta: string;
  secondaryCta: string;
  contact?: string;
  products?: string;
}

const mockSingleSiteHomeLinkTargets = vi.hoisted(
  (): { current: MockHomeLinkTargets } => ({
    current: {
      contact: "/contact",
      products: "/products",
      primaryCta: "/products",
      secondaryCta: "/contact",
    },
  }),
);

vi.mock("@/config/single-site-links", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/config/single-site-links")>()),
  get SINGLE_SITE_HOME_LINK_TARGETS() {
    return mockSingleSiteHomeLinkTargets.current;
  },
}));

vi.mock("@/components/layout/mobile-navigation", () => ({
  MobileNavigationLinks: () => (
    <nav data-testid="mobile-navigation">Mobile Navigation</nav>
  ),
}));

vi.mock("@/components/layout/logo", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

// Mock header islands and Idle wrapper to render immediately in tests
vi.mock("@/components/layout/header-client", () => ({
  MobileNavigationIsland: () => (
    <div data-testid="mobile-navigation">
      <button data-testid="header-mobile-menu-button" type="button">
        Menu
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild,
    variant: _variant,
    size: _size,
    ...props
  }: {
    children: ReactNode;
    asChild?: boolean;
    variant?: string;
    size?: string;
  }) => {
    if (asChild && isValidElement(children)) {
      return cloneElement(children, props);
    }

    return <button {...props}>{children}</button>;
  },
}));

/**
 * Helper to render async Server Components in tests.
 * Awaits the component and renders the resolved JSX.
 */
async function renderAsyncComponent(
  asyncComponent: React.JSX.Element | Promise<React.JSX.Element>,
) {
  const resolvedElement = await Promise.resolve(asyncComponent);
  return render(resolvedElement);
}

const MAIN_NAV_ITEMS = [
  { key: "home", href: "/", label: "Home" },
  { key: "products", href: "/products", label: "Products" },
];

const HEADER_LABELS = {
  contactSalesLabel: "Contact",
  openMenuLabel: "Open navigation menu",
  closeMenuLabel: "Close navigation menu",
  mainNavigationLabel: "Main navigation",
} as const;

describe("Header Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingleSiteHomeLinkTargets.current = {
      contact: "/contact",
      products: "/products",
      primaryCta: "/products",
      secondaryCta: "/contact",
    };
  });

  describe("Default Header", () => {
    it("renders all navigation components", async () => {
      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          mainNavItems: MAIN_NAV_ITEMS,
          mainNavigationLabel: "TEST desktop main navigation",
        }),
      );

      expect(screen.getByTestId("logo")).toBeInTheDocument();
      expect(
        screen.getByRole("navigation", {
          name: "TEST desktop main navigation",
        }),
      ).toBeInTheDocument();
      expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
    });

    it("does not delay first-screen header controls behind Idle", async () => {
      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          mainNavItems: MAIN_NAV_ITEMS,
        }),
      );

      expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
    });

    it("places desktop contact CTA in the utility controls", async () => {
      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          mainNavItems: MAIN_NAV_ITEMS,
        }),
      );

      const utilityRegion = screen.getByTestId("header-utility-controls");
      const contactCta = screen.getByTestId("header-cta");

      expect(utilityRegion.compareDocumentPosition(contactCta)).toBe(
        Node.DOCUMENT_POSITION_CONTAINED_BY | Node.DOCUMENT_POSITION_FOLLOWING,
      );
    });

    it("keeps a compact contact CTA visible in the mobile header", async () => {
      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          mainNavItems: MAIN_NAV_ITEMS,
        }),
      );

      const utilityRegion = screen.getByTestId("header-utility-controls");
      const mobileContactWrapper = screen.getByTestId(
        "header-mobile-cta-wrapper",
      );
      const mobileContactCta = screen.getByTestId("header-mobile-cta");
      const menuButton = screen.getByTestId("header-mobile-menu-button");

      expect(mobileContactWrapper).toHaveClass("header-mobile-only");
      expect(mobileContactCta).toHaveAttribute("href", "/contact");
      expect(mobileContactCta).toHaveTextContent("Contact");
      expect(
        mobileContactCta.compareDocumentPosition(menuButton) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(utilityRegion).toContainElement(mobileContactCta);
    });

    it("omits contact CTAs when the active profile has no contact route", async () => {
      mockSingleSiteHomeLinkTargets.current = {
        primaryCta: "/",
        secondaryCta: "/",
      };

      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          mainNavItems: MAIN_NAV_ITEMS,
        }),
      );

      expect(screen.queryByTestId("header-cta")).not.toBeInTheDocument();
      expect(
        screen.queryByTestId("header-mobile-cta-wrapper"),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId("header-mobile-cta")).not.toBeInTheDocument();
      expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
    });

    it("protects desktop navigation labels and CTA without broad wrappers", async () => {
      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          mainNavItems: MAIN_NAV_ITEMS,
        }),
      );

      expect(screen.getByTestId("header-desktop-nav")).not.toHaveAttribute(
        "translate",
        "no",
      );
      expect(screen.getByTestId("header-desktop-nav")).not.toHaveClass(
        "notranslate",
      );
      expect(screen.getByTestId("header-nav-label-home")).toHaveAttribute(
        "translate",
        "no",
      );
      expect(screen.getByTestId("header-contact-sales-label")).toHaveAttribute(
        "translate",
        "no",
      );
    });

    it("applies default sticky positioning", async () => {
      await renderAsyncComponent(Header({ ...HEADER_LABELS, locale: "en" }));

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("sticky", "top-0", "z-50");
    });

    it("applies custom className when provided", async () => {
      const customClass = "custom-header-class";
      await renderAsyncComponent(
        Header({ ...HEADER_LABELS, locale: "en", className: customClass }),
      );

      const header = screen.getByRole("banner");
      expect(header).toHaveClass(customClass);
    });

    it("can disable sticky positioning", async () => {
      await renderAsyncComponent(
        Header({ ...HEADER_LABELS, locale: "en", sticky: false }),
      );

      const header = screen.getByRole("banner");
      expect(header).not.toHaveClass("sticky");
    });
  });

  describe("Header Variants", () => {
    it("renders minimal variant correctly", async () => {
      await renderAsyncComponent(
        Header({ ...HEADER_LABELS, locale: "en", variant: "minimal" }),
      );

      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();
      expect(screen.getByTestId("logo")).toBeInTheDocument();
      // Minimal variant hides center nav
      expect(
        screen.queryByTestId("header-desktop-nav"),
      ).not.toBeInTheDocument();
    });

    it("renders transparent variant correctly", async () => {
      await renderAsyncComponent(
        Header({ ...HEADER_LABELS, locale: "en", variant: "transparent" }),
      );

      const header = screen.getByRole("banner");
      // Transparent variant always applies bg-transparent
      expect(header).toHaveClass("bg-transparent");
      // Transparent headers should not be sticky
      expect(header).not.toHaveClass("sticky");
    });

    it("transparent variant ignores sticky prop", async () => {
      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          variant: "transparent",
          sticky: true,
        }),
      );

      const header = screen.getByRole("banner");
      expect(header).not.toHaveClass("sticky");
    });
  });

  describe("Header variants", () => {
    it("minimal behavior via Header with minimal variant", async () => {
      await renderAsyncComponent(
        Header({ ...HEADER_LABELS, locale: "en", variant: "minimal" }),
      );

      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();
      // Minimal variant still has sticky positioning
      expect(header).toHaveClass("sticky");
    });

    it("transparent behavior via Header with transparent variant", async () => {
      await renderAsyncComponent(
        Header({ ...HEADER_LABELS, locale: "en", variant: "transparent" }),
      );

      const header = screen.getByRole("banner");
      // Transparent variant always applies bg-transparent
      expect(header).toHaveClass("bg-transparent");
      // Transparent variant disables sticky
      expect(header).not.toHaveClass("sticky");
    });

    it("Header accepts className prop with variant", async () => {
      const customClass = "custom-class";

      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          variant: "minimal",
          className: customClass,
        }),
      );
      expect(screen.getByRole("banner")).toHaveClass(customClass);
    });
  });

  describe("Accessibility", () => {
    it("has proper banner role", async () => {
      await renderAsyncComponent(Header({ ...HEADER_LABELS, locale: "en" }));

      expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("maintains focus management", async () => {
      await renderAsyncComponent(Header({ ...HEADER_LABELS, locale: "en" }));

      // Header should not interfere with focus management
      const header = screen.getByRole("banner");
      expect(header).not.toHaveAttribute("tabIndex");
    });
  });

  describe("Responsive Behavior", () => {
    it("contains both desktop and mobile navigation", async () => {
      await renderAsyncComponent(
        Header({
          ...HEADER_LABELS,
          locale: "en",
          mainNavItems: MAIN_NAV_ITEMS,
        }),
      );

      // Both should be present, visibility controlled by CSS
      expect(screen.getByTestId("header-desktop-nav")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
    });
  });
});
