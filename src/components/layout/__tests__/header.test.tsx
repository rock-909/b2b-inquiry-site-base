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

vi.mock("@/components/layout/logo", () => ({
  Logo: () => <div data-testid="logo">Logo</div>,
}));

vi.mock("@/components/layout/header-client", () => ({
  LanguageToggleIsland: () => (
    <div data-testid="language-toggle-island">Language</div>
  ),
  MobileNavigationIsland: () => (
    <div data-testid="mobile-navigation">
      <button data-testid="header-mobile-menu-button" type="button">
        Menu
      </button>
    </div>
  ),
}));

const MAIN_NAV_ITEMS = [
  { key: "home", href: "/", label: "Home" },
  { key: "products", href: "/products", label: "Products" },
];

const HEADER_LABELS = {
  contactSalesLabel: "Start an inquiry",
  openMenuLabel: "Open navigation menu",
  closeMenuLabel: "Close navigation menu",
  languageAriaLabel: "Languages: English",
  mainNavigationLabel: "Main navigation",
} as const;

function renderHeader() {
  return render(
    Header({
      ...HEADER_LABELS,
      locale: "en",
      mainNavItems: MAIN_NAV_ITEMS,
    }),
  );
}

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSingleSiteHomeLinkTargets.current = {
      contact: "/contact",
      products: "/products",
      primaryCta: "/products",
      secondaryCta: "/contact",
    };
  });

  it("renders the production navigation surface", () => {
    renderHeader();

    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("language-toggle-island")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
  });

  it("renders desktop and mobile inquiry CTAs", () => {
    renderHeader();

    expect(screen.getByTestId("header-cta")).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(screen.getByTestId("header-mobile-cta")).toHaveAttribute(
      "href",
      "/contact",
    );
    expect(screen.getAllByText("Start an inquiry")).toHaveLength(2);
  });

  it("omits inquiry CTAs when the active profile has no inquiry route", () => {
    mockSingleSiteHomeLinkTargets.current = {
      primaryCta: "/",
      secondaryCta: "/",
    };

    renderHeader();

    expect(screen.queryByTestId("header-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("header-mobile-cta")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
  });

  it("protects navigation labels from browser translation", () => {
    renderHeader();

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

  it("keeps the production sticky shell and accepts a custom class", () => {
    render(
      Header({
        ...HEADER_LABELS,
        locale: "en",
        className: "custom-header-class",
      }),
    );

    expect(screen.getByRole("banner")).toHaveClass(
      "sticky",
      "top-0",
      "z-50",
      "custom-header-class",
    );
  });
});
