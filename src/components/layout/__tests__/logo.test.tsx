/**
 * @vitest-environment jsdom
 * Tests for the Logo component.
 */
import React from "react";
import { render, screen } from "@testing-library/react";
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

  it("renders text fallback by default", () => {
    render(<Logo />);

    expect(screen.getByText(SITE_CONFIG.name)).toBeInTheDocument();
  });

  // 派生站把 logo 置为 ready 之前，品牌名是唯一标识；ready 后图片出现，文字只在桌面保留。
  it.each([
    { status: "pending" as const, imageSrc: null, textDesktopOnly: false },
    { status: "ready" as const, imageSrc: "/logo.svg", textDesktopOnly: true },
  ])(
    "renders the $status logo state",
    ({ status, imageSrc, textDesktopOnly }) => {
      SITE_CONFIG.brandAssets = {
        ...templateBrandAssets,
        logo: { status, horizontal: "/logo.svg", width: 240, height: 72 },
      };

      render(<Logo />);

      const image = screen.queryByRole("img", {
        name: `${SITE_CONFIG.name} Logo`,
      });
      expect(image?.getAttribute("src") ?? null).toBe(imageSrc);
      expect(
        screen
          .getByText(SITE_CONFIG.name)
          .classList.contains("header-logo-text-desktop-only"),
      ).toBe(textDesktopOnly);
    },
  );
});
