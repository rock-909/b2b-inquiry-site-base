/**
 * Header Integration Tests
 *
 * Tests for the async Server Component Header using a render helper
 * that awaits the component before passing to React Testing Library.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header as ProductionHeader } from "@/components/layout/header";

const DEFAULT_HEADER_LABELS = {
  contactSalesLabel: "Contact Sales",
  openMenuLabel: "Open menu",
  closeMenuLabel: "Close menu",
  mainNavigationLabel: "Main navigation",
} as const;

type HeaderProps = React.ComponentProps<typeof ProductionHeader>;
type TestHeaderProps = Omit<HeaderProps, keyof typeof DEFAULT_HEADER_LABELS> &
  Partial<typeof DEFAULT_HEADER_LABELS>;

function Header(props: TestHeaderProps = {}) {
  return ProductionHeader({ ...DEFAULT_HEADER_LABELS, ...props });
}

vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    __esModule: true,
    default: (
      importer: () => Promise<
        { default?: React.ComponentType<any> } | React.ComponentType<any>
      >,
    ) =>
      function DynamicComponent(props: Record<string, unknown>) {
        const [Loaded, setLoaded] =
          React.useState<React.ComponentType<any> | null>(null);

        React.useEffect(() => {
          let mounted = true;
          importer().then((mod) => {
            if (!mounted) return;
            const Component =
              typeof mod === "function"
                ? (mod as React.ComponentType<any>)
                : mod.default;
            setLoaded(() => Component ?? (() => null));
          });
          return () => {
            mounted = false;
          };
        }, []);

        if (!Loaded) return null;
        return React.createElement(Loaded, props);
      },
  };
});

vi.mock("@/components/layout/logo", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock("@/components/layout/mobile-navigation", () => ({
  MobileNavigationLinks: () => (
    <nav data-testid="mobile-navigation-links">
      <a href="/">Home</a>
    </nav>
  ),
}));

vi.mock("@/components/layout/mobile-navigation-interactive", () => ({
  MobileNavigationInteractive: ({
    children,
  }: {
    children?: React.ReactNode;
  }) => <div data-testid="mobile-navigation-interactive">{children}</div>,
}));

vi.mock("@/components/layout/header-client", () => ({
  MobileNavigationIsland: () => (
    <nav data-testid="mobile-navigation">Mobile Navigation</nav>
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
    children: React.ReactNode;
    asChild?: boolean;
    variant?: string;
    size?: string;
  }) => (asChild ? <>{children}</> : <button {...props}>{children}</button>),
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

describe("Header Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Component Integration", () => {
    it("should render all child components correctly", async () => {
      await renderAsyncComponent(
        Header({
          locale: "en",
          mainNavItems: [{ key: "home", href: "/", label: "Home" }],
        }),
      );

      // Verify all child components are rendered
      expect(screen.getByTestId("logo")).toBeInTheDocument();
      expect(screen.getByTestId("header-desktop-nav")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
    });

    it("should protect desktop navigation and CTA labels without broad wrappers", async () => {
      await renderAsyncComponent(
        Header({
          locale: "en",
          mainNavItems: [{ key: "home", href: "/", label: "Home" }],
        }),
      );

      expect(screen.getByTestId("header-desktop-nav")).not.toHaveClass(
        "notranslate",
      );
      expect(screen.getByTestId("header-desktop-nav")).not.toHaveAttribute(
        "translate",
        "no",
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

    it("should have correct default structure and classes", async () => {
      await renderAsyncComponent(Header({ locale: "en" }));

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("backdrop-blur-md");
      expect(header).toHaveClass("w-full");
      expect(header).toHaveClass("border-b");
      expect(header).toHaveClass("sticky");
      expect(header).toHaveClass("top-0");
      expect(header).toHaveClass("z-50");
      expect(header).toHaveClass("transition-[background-color,border-color]");
      expect(header).toHaveClass("duration-200");
    });

    it("should apply custom className", async () => {
      const customClass = "custom-header-class";
      await renderAsyncComponent(
        Header({ locale: "en", className: customClass }),
      );

      const header = screen.getByRole("banner");
      expect(header).toHaveClass(customClass);
    });
  });

  describe("Variant Behavior", () => {
    it("should apply default variant styles", async () => {
      await renderAsyncComponent(Header({ locale: "en", variant: "default" }));

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("sticky");
      expect(header).toHaveClass("border-b");
      expect(header).toHaveClass("backdrop-blur-md");
    });

    it("should apply minimal variant styles", async () => {
      await renderAsyncComponent(Header({ locale: "en", variant: "minimal" }));

      const header = screen.getByRole("banner");
      expect(header).toHaveClass("sticky");
      expect(header).toHaveClass("border-b");
      expect(header).toHaveClass("backdrop-blur-md");
      // Minimal variant hides center nav
      expect(
        screen.queryByTestId("header-desktop-nav"),
      ).not.toBeInTheDocument();
    });

    it("should apply transparent variant styles", async () => {
      await renderAsyncComponent(
        Header({ locale: "en", variant: "transparent" }),
      );

      const header = screen.getByRole("banner");
      expect(header).not.toHaveClass("sticky");
      // Transparent variant applies bg-transparent
      expect(header).toHaveClass("bg-transparent");
    });

    it("should handle sticky prop correctly", async () => {
      await renderAsyncComponent(Header({ locale: "en", sticky: true }));
      const header = screen.getByRole("banner");
      expect(header).toHaveClass("sticky");
    });

    it("should handle sticky=false correctly", async () => {
      await renderAsyncComponent(Header({ locale: "en", sticky: false }));
      const header = screen.getByRole("banner");
      expect(header).not.toHaveClass("sticky");
    });

    it("should override sticky prop for transparent variant", async () => {
      await renderAsyncComponent(
        Header({ locale: "en", variant: "transparent", sticky: true }),
      );

      const header = screen.getByRole("banner");
      // Transparent variant should never be sticky, even if sticky=true
      expect(header).not.toHaveClass("sticky");
    });
  });

  describe("Responsive Behavior", () => {
    it("should contain responsive container", async () => {
      await renderAsyncComponent(Header({ locale: "en" }));

      const container = screen
        .getByRole("banner")
        .querySelector(".mx-auto.max-w-\\[1080px\\]");
      expect(container).toBeInTheDocument();
      expect(container).toHaveClass("px-6");
    });

    it("should render both desktop and mobile navigation", async () => {
      await renderAsyncComponent(
        Header({
          locale: "en",
          mainNavItems: [{ key: "home", href: "/", label: "Home" }],
        }),
      );

      // Both navigation components should be present
      // (visibility is controlled by CSS classes)
      expect(screen.getByTestId("header-desktop-nav")).toBeInTheDocument();
      expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic structure", async () => {
      await renderAsyncComponent(Header({ locale: "en" }));

      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();
      expect(header.tagName).toBe("HEADER");
    });

    it("should be keyboard navigable", async () => {
      await renderAsyncComponent(
        Header({
          locale: "en",
          mainNavItems: [{ key: "home", href: "/", label: "Home" }],
        }),
      );

      const header = screen.getByRole("banner");

      // Header should be focusable for screen readers
      expect(header).toBeInTheDocument();

      // Child components should handle their own keyboard navigation
      expect(screen.getByTestId("header-desktop-nav")).toBeInTheDocument();
    });
  });

  describe("Component Interaction", () => {
    it("should maintain component hierarchy", async () => {
      await renderAsyncComponent(
        Header({
          locale: "en",
          mainNavItems: [{ key: "home", href: "/", label: "Home" }],
        }),
      );

      const header = screen.getByRole("banner");
      const container = header.querySelector(".mx-auto.max-w-\\[1080px\\]");

      expect(container).toBeInTheDocument();
      expect(header).toContainElement(container as HTMLElement);

      // All components should be within the container
      const logo = screen.getByTestId("logo");
      const navSwitcher = screen.getByTestId("header-desktop-nav");
      const mobileNav = screen.getByTestId("mobile-navigation");

      expect(container).toContainElement(logo);
      expect(container).toContainElement(navSwitcher);
      expect(container).toContainElement(mobileNav);
    });
  });

  describe("Error Handling", () => {
    it("should render gracefully with default variant", async () => {
      await renderAsyncComponent(Header({ locale: "en" }));

      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();

      // Should have default variant styles
      expect(header).toHaveClass("sticky");
    });

    it("should handle invalid variant gracefully", async () => {
      await renderAsyncComponent(
        Header({
          locale: "en",
          variant: "invalid" as unknown as
            "default" | "minimal" | "transparent",
        }),
      );

      const header = screen.getByRole("banner");
      expect(header).toBeInTheDocument();

      // Should apply default behavior
      expect(header).toHaveClass("sticky");
    });
  });

  describe("Performance", () => {
    it("should render efficiently with different props", async () => {
      // Initial render should work
      await renderAsyncComponent(Header({ locale: "en" }));
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });

    it("should render minimal variant correctly", async () => {
      await renderAsyncComponent(Header({ locale: "en", variant: "minimal" }));
      expect(screen.getByRole("banner")).toBeInTheDocument();
    });
  });
});
