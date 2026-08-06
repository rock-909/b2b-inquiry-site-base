/**
 * @vitest-environment jsdom
 */

/**
 * MobileNavigationInteractive — the client drawer island.
 *
 * Sole owner of drawer interaction proofs against the REAL Radix Sheet:
 * open/close via trigger, close button, Escape, nav-link click and route
 * change; keyboard focus movement; active-route wiring; translated chrome;
 * and graceful degradation. Static link-list content is proven in
 * mobile-navigation-links.test.tsx; the standalone toggle button in
 * mobile-menu-button.test.tsx.
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
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

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
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
      expect(screen.queryByText("Home")).not.toBeInTheDocument();
    });

    it("applies a custom className to the container", () => {
      render(
        <MobileNavigation {...MOBILE_NAV_LABELS} className="custom-nav" />,
      );

      expect(screen.getByRole("button").closest("div")).toHaveClass(
        "custom-nav",
      );
    });

    it("exposes accessible focus and touch-target styling on the trigger", () => {
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button");
      expect(trigger).toHaveClass(
        "focus-visible:ring-2",
        "focus-visible:ring-ring",
        "outline-none",
        "size-9",
      );
    });
  });

  describe("Open and close", () => {
    it("opens on click, revealing the drawer, close icon and switched label", () => {
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

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
        screen.getByRole("link", { name: "Request a Quote" }),
      ).toBeInTheDocument();
    });

    it("closes again when the trigger is clicked a second time", () => {
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });

    it("closes via the drawer's dedicated close button", async () => {
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

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
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      await user.click(trigger);
      await user.click(screen.getByRole("link", { name: "Home" }));

      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("toggles reliably back to a closed state after rapid clicking", () => {
      // Formerly "handles rapid interactions efficiently": this measures no
      // timing, it proves that an even number of toggles ends up closed.
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      for (let i = 0; i < 10; i++) {
        fireEvent.click(trigger);
      }

      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    });
  });

  describe("Keyboard", () => {
    it("opens with Enter and closes with Escape, returning focus to the trigger", async () => {
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      await user.tab();
      expect(trigger).toHaveFocus();

      await user.keyboard("{Enter}");
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      await user.keyboard("{Escape}");
      expect(trigger).toHaveAttribute("aria-expanded", "false");
      expect(trigger).toHaveFocus();
    });

    it("moves focus between navigation items with Tab", async () => {
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      await user.click(screen.getByRole("button", { name: /menu/i }));

      const [homeLink, productsLink, thirdLink] = screen.getAllByRole(
        "link",
      ) as HTMLAnchorElement[];
      if (!homeLink || !productsLink || !thirdLink) {
        throw new Error("Expected at least three navigation links when open");
      }

      homeLink.focus();
      expect(homeLink).toHaveFocus();

      await user.tab();
      expect(productsLink).toHaveFocus();

      await user.tab();
      expect(thirdLink).toHaveFocus();
    });
  });

  describe("Route awareness", () => {
    it("closes the drawer when the pathname changes", () => {
      const { rerender } = render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");

      mockPathname.current = "/about";
      rerender(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      expect(trigger).toHaveAttribute("aria-expanded", "false");
    });

    it("marks the current route's item with aria-current", () => {
      mockPathname.current = "/about";
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      fireEvent.click(screen.getByRole("button", { name: /menu/i }));

      expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute(
        "aria-current",
      );
    });
  });

  describe("Translation", () => {
    it("renders localized labels and switches the screen-reader label (CJK)", () => {
      (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
        createMockUseTranslations({
          "navigation.home": "首页",
          "navigation.about": "关于我们",
          "accessibility.openMenu": "打开菜单",
          "accessibility.closeMenu": "关闭菜单",
          "accessibility.mobileNavigation": "TEST mobile nav landmark",
        }),
      );

      render(
        <MobileNavigation openMenuLabel="打开菜单" closeMenuLabel="关闭菜单" />,
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
      expect(screen.getByText("关于我们")).toBeInTheDocument();
    });

    it("renders the translated site description inside the drawer", () => {
      (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
        createMockUseTranslations({
          "navigation.siteDescription": "Factory-direct flood barrier supply.",
        }),
      );

      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);
      fireEvent.click(screen.getByRole("button", { name: /menu/i }));

      expect(
        screen.getByText("Factory-direct flood barrier supply."),
      ).toBeInTheDocument();
    });
  });

  describe("Graceful degradation", () => {
    it("renders visible fallback keys when translations are missing", () => {
      (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(
        (namespace?: string) => (key: string) =>
          namespace ? `${namespace}.${key}` : key,
      );

      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);
      fireEvent.click(screen.getByRole("button", { name: /menu/i }));

      expect(screen.getByText("navigation.home")).toBeInTheDocument();
      expect(screen.getByText("navigation.about")).toBeInTheDocument();
    });

    it("renders without marking any item active when the pathname is undefined", () => {
      mockPathname.current = undefined;
      render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      const trigger = screen.getByRole("button", { name: /menu/i });
      fireEvent.click(trigger);

      expect(trigger).toHaveAttribute("aria-expanded", "true");
      for (const link of screen.getAllByRole("link")) {
        expect(link).not.toHaveAttribute("aria-current");
      }
    });

    it("surfaces translation failures instead of swallowing them", () => {
      (useTranslations as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error("Translation error");
      });

      expect(() => render(<MobileNavigation {...MOBILE_NAV_LABELS} />)).toThrow(
        "Translation error",
      );
    });
  });

  describe("Lifecycle", () => {
    it("unmounts cleanly", () => {
      // Formerly "handles memory efficiently" / "prevents memory leak": there
      // is no memory measurement, only a clean-teardown assertion.
      const { unmount } = render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      expect(screen.getByRole("button")).toBeInTheDocument();
      expect(() => unmount()).not.toThrow();
    });

    it("stays mounted and reflects prop changes across re-renders", () => {
      // Formerly "maintains performance with frequent re-renders" /
      // "optimizes re-renders": no render-count instrumentation, just proof
      // the island survives repeated re-renders and picks up new props.
      const { rerender } = render(<MobileNavigation {...MOBILE_NAV_LABELS} />);

      for (let i = 0; i < 5; i++) {
        rerender(
          <MobileNavigation {...MOBILE_NAV_LABELS} className={`class-${i}`} />,
        );
      }

      const trigger = screen.getByRole("button");
      expect(trigger).toBeInTheDocument();
      expect(trigger.closest("div")).toHaveClass("class-4");
    });
  });
});
