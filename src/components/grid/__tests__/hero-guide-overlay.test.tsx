/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroGuideOverlay } from "@/components/grid/hero-guide-overlay";

describe("HeroGuideOverlay", () => {
  it("renders with aria-hidden", () => {
    const { container } = render(<HeroGuideOverlay />);

    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toHaveAttribute("aria-hidden", "true");
  });

  it("hides below lg via class and never sets inline display", () => {
    const { container } = render(<HeroGuideOverlay />);

    const overlay = container.firstChild as HTMLElement;
    // Tailwind `hidden` = display:none; `lg:grid` = display:grid from lg up.
    // Inline display:grid previously overrode `hidden` and kept guides on mobile.
    expect(overlay).toHaveClass("hidden", "lg:grid");
    expect(overlay).not.toHaveClass("lg:block");
    expect(overlay.style.display).toBe("");
  });

  it("uses 12-column 8-row grid template without forcing display", () => {
    const { container } = render(<HeroGuideOverlay />);

    const overlay = container.firstChild as HTMLElement;
    expect(overlay.style.gridTemplateColumns).toBe("repeat(12, 1fr)");
    expect(overlay.style.gridTemplateRows).toBe("repeat(8, 1fr)");
    expect(overlay.style.display).toBe("");
  });

  it("renders guide cells", () => {
    const { container } = render(<HeroGuideOverlay />);

    const overlay = container.firstChild as HTMLElement;
    expect(overlay.children.length).toBeGreaterThan(0);
  });

  it("applies pointer-events-none on container", () => {
    const { container } = render(<HeroGuideOverlay />);

    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toHaveClass("pointer-events-none");
  });

  it("is centered with translate and 1080px max width", () => {
    const { container } = render(<HeroGuideOverlay />);

    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toHaveClass(
      "left-1/2",
      "-translate-x-1/2",
      "max-w-[1080px]",
    );
  });
});
