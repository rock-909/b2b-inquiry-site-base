/**
 * @vitest-environment jsdom
 */

/**
 * MobileNavigationInteractive — the client drawer island.
 *
 * Sole owner of drawer interaction proofs against the real Base UI Sheet:
 * open/close via trigger, close button, Enter/Escape, nav-link click and route
 * change; active-route wiring; translated chrome; and an undefined pathname.
 * Static link-list content is proven in mobile-navigation-links.test.tsx.
 * Focus trapping and restoration need a real browser (e2e navigation.spec.ts).
 *
 * Every test drives the component through its public surface; nothing here is
 * a bare "does not throw" smoke test, and nothing named "performance" or
 * "memory" claims a measurement it does not take.
 */

import { usePathname } from "next/navigation";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslations } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNavigationInteractive as MobileNavigation } from "@/components/layout/mobile-navigation-interactive";
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
  useFormatter: vi.fn(() => ({
    dateTime: vi.fn(),
    number: vi.fn(),
    relativeTime: vi.fn(),
  })),
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  redirect: vi.fn(),
  permanentRedirect: vi.fn(),
}));

// Mutable pathname source read by the component's @/i18n/routing usePathname.
const mockPathname: { current: string | undefined } = { current: "/" };

vi.mock("@/i18n/routing", () => ({
  Link: ({
    children,
    href,
    className,
    onClick,
    prefetch: _prefetch,
    ...props
  }: any) => (
    <a
      href={stringifyMockHref(href)}
      className={className}
      onClick={onClick}
      {...props}
    >
      {children}
    </a>
  ),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  })),
  usePathname: vi.fn(() => mockPathname.current),
}));

vi.mock("lucide-react", () => ({
  Menu: () => <span data-testid="menu-icon">☰</span>,
  X: () => <span data-testid="close-icon">✕</span>,
  // The Sheet wrapper renders its built-in close affordance with XIcon.
  XIcon: () => <span data-testid="x-icon">✕</span>,
  Globe: () => <span data-testid="globe-icon">🌐</span>,
  Check: () => <span data-testid="check-icon">✓</span>,
}));

const MOBILE_NAV_LABELS = {
  openMenuLabel: "Open navigation menu",
  closeMenuLabel: "Close navigation menu",
} as const;

describe("MobileNavigationInteractive", () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    mockPathname.current = "/";
    (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
      createMockUseTranslations(),
    );
    (usePathname as ReturnType<typeof vi.fn>).mockReturnValue("/");
  });

  describe("Rendering (closed)", () => {
    it("renders the trigger with closed ARIA inside the mobile-only shell", () => {
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      expect(trigger).toHaveAttribute("type", "button");
      expect(trigger).not.toHaveAttribute("aria-label");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveAttribute("aria-controls", "mobile-navigation");
      expect(screen.getByTestId("menu-icon")).toBeInTheDocument();
      expect(trigger.closest("div")).toHaveClass("header-mobile-only");
      // The toggle label is shielded from machine translation.
      expect(screen.getByTestId("mobile-menu-toggle-label")).toHaveAttribute(
        "translate",
        "no",
      );
    });

    it("shows no navigation landmark or items until opened", () => {
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(screen.queryByText("Home")).not.toBeInTheDocument();
    });
  });

  describe("Open and close", () => {
    it("opens on click, revealing the drawer, close icon and switched label", () => {
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByTestId("mobile-menu-toggle-label")).toHaveTextContent(
        "Close navigation menu",
      );
      expect(screen.getByTestId("close-icon")).toBeInTheDocument();
      const nav = screen.getByRole("navigation", {
        name: "Mobile navigation menu",
      });
      expect(nav).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
      expect(
        screen.getAllByRole("link", { name: "Start an inquiry" }).at(-1),
      ).toBeInTheDocument();
    });

    it("closes again when the trigger is clicked a second time", () => {
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("closes via the drawer's dedicated close button", async () => {
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      fireEvent.click(screen.getByRole("button", { name: /menu/i }));
      expect(screen.getByRole("navigation")).toBeInTheDocument();

      const drawer = screen.getByTestId("mobile-menu-content");
      const closeButton = drawer.querySelector("button");
      if (!closeButton) {
        throw new Error("Expected the drawer's built-in close button");
      }
      await user.click(closeButton);
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("closes when a navigation link is clicked", async () => {
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      await user.click(trigger);
      await user.click(screen.getByRole("link", { name: "Home" }));

      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("Keyboard", () => {
    // 焦点归还属于真实浏览器行为，由 e2e navigation.spec.ts 证明；这里只守按键接线。
    it("opens with Enter and closes with Escape", async () => {
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      await user.tab();
      expect(trigger).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await user.keyboard("{Escape}");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("Route awareness", () => {
    it("closes the drawer when the pathname changes", () => {
      const { rerender } = render(
        <MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />,
      );

      const trigger = screen.getByRole("button", { name: /menu/i });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      mockPathname.current = "/contact";
      rerender(
        <MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />,
      );

      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("marks the current route's item with aria-current", () => {
      mockPathname.current = "/";
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      fireEvent.click(screen.getByRole("button", { name: /menu/i }));

      expect(
        screen.getByRole("link", { name: "Home", current: "page" }),
      ).toHaveAttribute("aria-current", "page");
      expect(
        screen.getByRole("link", { name: "Start an inquiry" }),
      ).not.toHaveAttribute("aria-current");
    });
  });

  describe("Translation", () => {
    it("renders localized labels and switches the screen-reader label (CJK)", () => {
      (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
        createMockUseTranslations({
          "navigation.home": "首页",
          "navigation.contactSales": "联系销售",
          "accessibility.openMenu": "打开菜单",
          "accessibility.closeMenu": "关闭菜单",
          "accessibility.mobileNavigation": "TEST mobile nav landmark",
        }),
      );

      render(
        <MobileNavigation
          siteName="Test Site"
          openMenuLabel="打开菜单"
          closeMenuLabel="关闭菜单"
        />,
      );

      expect(screen.getByTestId("mobile-menu-toggle-label")).toHaveTextContent(
        "打开菜单",
      );
      const trigger = screen.getByRole("button");
      expect(trigger).not.toHaveAttribute("aria-label");

      fireEvent.click(trigger);
      expect(
        screen.getByTestId("mobile-menu-content").querySelector("button"),
      ).toHaveTextContent("✕");
      expect(screen.getByTestId("mobile-menu-content")).toHaveTextContent(
        "关闭菜单",
      );
      expect(
        screen.getByRole("navigation", { name: "TEST mobile nav landmark" }),
      ).toBeInTheDocument();
      expect(screen.getByText("首页")).toBeInTheDocument();
      // 联系页只由 CTA 承担，不再作为导航项重复出现。
      expect(screen.getAllByText("联系销售")).toHaveLength(1);
    });

    it("renders the translated site description inside the drawer", () => {
      (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
        createMockUseTranslations({
          "navigation.siteDescription": "A neutral B2B inquiry site reference.",
        }),
      );

      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);
      fireEvent.click(screen.getByRole("button", { name: /menu/i }));

      expect(
        screen.getByText("A neutral B2B inquiry site reference."),
      ).toBeInTheDocument();
    });
  });

  describe("Graceful degradation", () => {
    it("renders without marking any item active when the pathname is undefined", () => {
      mockPathname.current = undefined;
      render(<MobileNavigation siteName="Test Site" {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      for (const link of screen.getAllByRole("link")) {
        expect(link).not.toHaveAttribute("aria-current");
      }
    });
  });
});
