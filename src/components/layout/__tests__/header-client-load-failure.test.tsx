/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LanguageToggleIsland, MobileNavigationIsland } from "../header-client";

vi.mock("@/i18n/routing", () => ({
  usePathname: () => "/",
}));

vi.mock("@/components/layout/mobile-navigation-interactive", () => {
  throw new Error("simulated chunk load failure");
});

vi.mock("@/components/layout/header-language-menu", () => {
  throw new Error("simulated chunk load failure");
});

describe("header islands when their chunk fails to load", () => {
  it("keeps the native mobile navigation links usable", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(
      <MobileNavigationIsland
        openMenuLabel="Open navigation menu"
        closeMenuLabel="Close navigation menu"
      >
        <a href="/products">Products</a>
      </MobileNavigationIsland>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("header-mobile-menu-button"));
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId("header-mobile-menu-button")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute(
      "href",
      "/products",
    );
    consoleError.mockRestore();
  });

  it("keeps an idle language trigger instead of a stuck loading state", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    render(<LanguageToggleIsland ariaLabel="Language: English" locale="en" />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("language-toggle-button"));
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId("language-toggle-button")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    consoleError.mockRestore();
  });
});
