import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/layout/header";
import type { HeaderNavItem } from "@/components/layout/header-nav-menu";
import { usePathname } from "@/i18n/routing";

// 语言切换只在多语言时出现；用固定双语 fixture，和站点当前配几种语言解耦。
vi.hoisted(() => vi.resetModules());
vi.mock("@/config/paths/locales-config", () => import("@/test/two-locales"));

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

// 模板不带二级菜单示例数据；这里的菜单项只存在于测试里。
const MENU_NAV_ITEMS: HeaderNavItem[] = [
  { key: "home", href: "/", label: "Home" },
  {
    key: "solutions",
    label: "Solutions",
    groups: [
      {
        key: "industries",
        label: "Industries",
        links: [
          { key: "mining", href: "/terms", label: "Mining" },
          {
            key: "catalog",
            href: "https://example.com/catalog",
            label: "Catalog",
            external: true,
          },
        ],
      },
    ],
  },
];

const HEADER_LABELS = {
  contactSalesLabel: "Start an inquiry",
  openMenuLabel: "Open navigation menu",
  closeMenuLabel: "Close navigation menu",
  languageAriaLabel: "Languages: English",
  mainNavigationLabel: "Main navigation",
} as const;

function renderHeader(mainNavItems: HeaderNavItem[] = MAIN_NAV_ITEMS) {
  return render(Header({ ...HEADER_LABELS, locale: "en", mainNavItems }));
}

describe("Header", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the production navigation surface", () => {
    renderHeader();

    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("language-toggle-island")).toBeInTheDocument();
    expect(screen.getByTestId("mobile-navigation")).toBeInTheDocument();
  });

  it("marks the current page in the desktop navigation", () => {
    vi.mocked(usePathname).mockReturnValue("/products");
    renderHeader();

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(nav).getByRole("link", { name: "Products" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(nav).getByRole("link", { name: "Home" })).not.toHaveAttribute(
      "aria-current",
    );
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

  it("keeps the production sticky shell", () => {
    renderHeader();

    expect(screen.getByRole("banner")).toHaveClass("sticky", "top-0", "z-50");
  });

  it("server-renders an item with sub-items as a disclosure trigger and its grouped links", () => {
    // 无 JS 的 HTML 里就要有二级链接，搜索引擎和 AI 抓取才能读到。
    const html = renderToStaticMarkup(
      Header({ ...HEADER_LABELS, locale: "en", mainNavItems: MENU_NAV_ITEMS }),
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    const nav = doc.querySelector('nav[aria-label="Main navigation"]');
    const trigger = [...(nav?.querySelectorAll("button") ?? [])].find(
      (button) => button.textContent === "Solutions",
    );

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    const panel = doc.getElementById(
      trigger?.getAttribute("aria-controls") ?? "",
    );
    expect(panel?.hasAttribute("hidden")).toBe(true);
    expect(nav?.contains(panel ?? null)).toBe(true);

    const group = panel?.querySelector('ul[aria-label="Industries"]');
    const links = [...(group?.querySelectorAll("a") ?? [])].map((link) => ({
      text: link.textContent,
      href: link.getAttribute("href"),
      target: link.getAttribute("target"),
      rel: link.getAttribute("rel"),
    }));
    expect(links).toEqual([
      { text: "Mining", href: "/terms", target: null, rel: null },
      {
        text: "Catalog↗",
        href: "https://example.com/catalog",
        target: "_blank",
        rel: "noopener noreferrer",
      },
    ]);
  });

  it("opens the sub-menu by click or keyboard and closes it by click, Escape or an outside press", async () => {
    const user = userEvent.setup();
    renderHeader(MENU_NAV_ITEMS);
    const trigger = screen.getByRole("button", { name: "Solutions" });
    const panelLinks = () => screen.queryByRole("list", { name: "Industries" });

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(panelLinks()).not.toBeNull();
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(panelLinks()).toBeNull();

    trigger.focus();
    await user.keyboard("{Enter}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.keyboard("{Escape}");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    trigger.focus();
    await user.keyboard("{ArrowDown}");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    await user.click(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
