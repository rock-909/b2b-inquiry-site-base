/**
 * @vitest-environment jsdom
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HeroGuideOverlay } from "@/components/grid/hero-guide-overlay";

describe("HeroGuideOverlay", () => {
  it("renders one non-interactive desktop-only decorative layer", () => {
    const { container } = render(<HeroGuideOverlay />);

    const overlay = container.firstChild as HTMLElement;
    expect(overlay).toHaveAttribute("aria-hidden", "true");
    expect(overlay).toHaveClass(
      "hidden",
      "lg:block",
      "pointer-events-none",
      "left-1/2",
      "-translate-x-1/2",
      "max-w-[1080px]",
    );
    expect(overlay).toBeEmptyDOMElement();
  });
});
