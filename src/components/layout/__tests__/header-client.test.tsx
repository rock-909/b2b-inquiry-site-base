/**
 * @vitest-environment jsdom
 * Tests for header client components (Island components)
 */
import { readFileSync } from "node:fs";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { MobileNavigationIsland } from "../header-client";

vi.mock("@/components/layout/mobile-navigation-interactive", () => ({
  MobileNavigationInteractive: ({
    children,
    closeMenuLabel,
    initialOpen,
    openMenuLabel,
  }: {
    children?: React.ReactNode;
    closeMenuLabel?: string;
    initialOpen?: boolean;
    openMenuLabel?: string;
  }) => (
    <div
      data-testid="mobile-navigation-interactive"
      data-close-menu-label={closeMenuLabel}
      data-initial-open={String(initialOpen ?? false)}
      data-open-menu-label={openMenuLabel}
    >
      {children}
    </div>
  ),
}));

describe("header client entry", () => {
  it("keeps always-present header islands free of next/dynamic runtime", () => {
    const source = readFileSync("src/components/layout/header-client.tsx", {
      encoding: "utf8",
    });

    expect(source).not.toContain("next/dynamic");
  });

  it("keeps mobile fallback markup in a non-boundary helper module", () => {
    const headerClientSource = readFileSync(
      "src/components/layout/header-client.tsx",
      {
        encoding: "utf8",
      },
    );
    const fallbackSource = readFileSync(
      "src/components/layout/header-mobile-navigation-fallback.tsx",
      {
        encoding: "utf8",
      },
    );

    expect(headerClientSource).toContain(
      "@/components/layout/header-mobile-navigation-fallback",
    );
    expect(fallbackSource).toContain("function MobileNavigationFallback");
    expect(fallbackSource).not.toMatch(/^["']use client["'];?$/m);
  });
});

const MOBILE_NAV_ISLAND_LABELS = {
  openMenuLabel: "Open navigation menu",
  closeMenuLabel: "Close navigation menu",
} as const;

describe("MobileNavigationIsland", () => {
  it("renders deferred trigger before loading dynamic component", () => {
    render(<MobileNavigationIsland {...MOBILE_NAV_ISLAND_LABELS} />);

    const trigger = screen.getByTestId("header-mobile-menu-button");
    expect(trigger).toBeInTheDocument();
    expect(trigger).not.toHaveAttribute("aria-haspopup");
    expect(trigger).not.toHaveAttribute("aria-label");
    expect(trigger).toHaveAttribute("aria-controls", "mobile-navigation");
    expect(screen.getByTestId("header-mobile-menu-label")).toHaveTextContent(
      "Open navigation menu",
    );
    expect(
      screen.getByTestId("header-mobile-navigation-fallback"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("mobile-navigation-interactive"),
    ).not.toBeInTheDocument();
  });

  it("server-renders mobile navigation fallback without loading interactive navigation", () => {
    const html = renderToStaticMarkup(
      <MobileNavigationIsland {...MOBILE_NAV_ISLAND_LABELS}>
        <nav data-testid="header-mobile-navigation-fallback-links">
          Fallback navigation
        </nav>
      </MobileNavigationIsland>,
    );

    expect(html).toContain('data-testid="header-mobile-menu-button"');
    expect(html).toContain(
      'data-testid="header-mobile-navigation-fallback-links"',
    );
    expect(html).not.toContain("简体中文");
    expect(html).not.toContain('hrefLang="zh"');
    expect(html).not.toContain("/zh");
    expect(html).not.toContain("mobile-language-fallback");
    expect(html).not.toContain("mobile-navigation-interactive");
  });

  it("passes localized labels to the hydrated mobile navigation", async () => {
    render(
      <MobileNavigationIsland
        {...MOBILE_NAV_ISLAND_LABELS}
        openMenuLabel="打开导航菜单"
        closeMenuLabel="关闭导航菜单"
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("header-mobile-menu-button"));
      await vi.dynamicImportSettled();
    });

    const interactive = screen.getByTestId("mobile-navigation-interactive");
    expect(interactive).toHaveAttribute("data-open-menu-label", "打开导航菜单");
    expect(interactive).toHaveAttribute(
      "data-close-menu-label",
      "关闭导航菜单",
    );
  });

  it("loads interactive component after trigger click", async () => {
    render(<MobileNavigationIsland {...MOBILE_NAV_ISLAND_LABELS} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("header-mobile-menu-button"));
      await vi.dynamicImportSettled();
    });

    const interactive = screen.getByTestId("mobile-navigation-interactive");
    expect(interactive).toHaveAttribute("data-initial-open", "true");
    expect(
      screen.queryByTestId("header-mobile-navigation-fallback"),
    ).not.toBeInTheDocument();
  });

  it("marks the deferred menu label as notranslate", () => {
    render(
      <MobileNavigationIsland
        {...MOBILE_NAV_ISLAND_LABELS}
        openMenuLabel="Open navigation menu"
      />,
    );

    expect(screen.getByTestId("header-mobile-menu-label")).toHaveAttribute(
      "translate",
      "no",
    );
  });
});

describe("Island components integration", () => {
  it("mobile island renders without loading hydrated navigation", async () => {
    const { container } = render(
      <>
        <MobileNavigationIsland {...MOBILE_NAV_ISLAND_LABELS} />
      </>,
    );

    expect(screen.getByTestId("header-mobile-menu-button")).toBeInTheDocument();

    await act(async () => {
      await vi.dynamicImportSettled();
    });

    const dynamicComponents = container.querySelectorAll(
      '[data-testid="mobile-navigation-interactive"]',
    );
    expect(dynamicComponents.length).toBe(0);
  });
});
