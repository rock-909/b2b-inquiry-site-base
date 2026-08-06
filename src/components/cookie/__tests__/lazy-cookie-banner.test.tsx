import { readFileSync } from "node:fs";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/cookie/cookie-banner", () => ({
  CookieBanner: ({ className }: { className?: string }) => (
    <div data-testid="cookie-banner" data-class={className ?? ""} />
  ),
}));

describe("LazyCookieBanner", () => {
  it("keeps the banner lazy loader free of next/dynamic runtime", () => {
    const source = readFileSync(
      "src/components/cookie/lazy-cookie-banner.tsx",
      "utf8",
    );

    expect(source).not.toContain("next/dynamic");
  });

  it("loads CookieBanner through React lazy/Suspense", async () => {
    const { LazyCookieBanner } = await import("../lazy-cookie-banner");

    render(<LazyCookieBanner className="banner-class" />);

    await act(async () => {
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId("cookie-banner")).toHaveAttribute(
      "data-class",
      "banner-class",
    );
  });
});
