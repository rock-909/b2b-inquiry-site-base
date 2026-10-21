/**
 * @vitest-environment jsdom
 * Tests for the Logo component.
 */
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SITE_CONFIG as SITE_CONFIG } from "@/config/single-site";
import { Logo } from "../logo";

// Mock @/i18n/routing Link (locale-aware navigation)
vi.mock("@/i18n/routing", () => ({
  Link: ({
    href,
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={href} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

describe("Logo", () => {
  const templateBrandAssets = SITE_CONFIG.brandAssets;

  afterEach(() => {
    SITE_CONFIG.brandAssets = templateBrandAssets;
  });

  // 没有可公开的 logo 时页头不留品牌位，也不留空的可聚焦链接。
  it.each([
    { name: "no logo", brandAssets: templateBrandAssets },
    {
      name: "pending logo",
      brandAssets: {
        ...templateBrandAssets,
        logo: {
          status: "pending" as const,
          horizontal: "/logo.svg",
          width: 240,
          height: 72,
        },
      },
    },
  ])("renders nothing with $name", ({ brandAssets }) => {
    SITE_CONFIG.brandAssets = brandAssets;

    const { container } = render(<Logo />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the ready logo image as the home link", () => {
    SITE_CONFIG.brandAssets = {
      ...templateBrandAssets,
      logo: {
        status: "ready",
        horizontal: "/logo.svg",
        width: 240,
        height: 72,
      },
    };

    render(<Logo />);

    const link = screen.getByRole("link", { name: SITE_CONFIG.name });
    expect(link).toHaveAttribute("href", "/");
    expect(
      within(link).getByRole("img", { name: `${SITE_CONFIG.name} Logo` }),
    ).toHaveAttribute("src", "/logo.svg");
  });
});
