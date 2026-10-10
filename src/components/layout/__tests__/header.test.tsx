import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/layout/header";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";

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
  });

  it("renders the production navigation surface", () => {
    renderHeader();

    expect(
      screen.getByRole("link", { name: SINGLE_SITE_CONFIG.name }),
    ).toHaveAttribute("href", "/");
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
