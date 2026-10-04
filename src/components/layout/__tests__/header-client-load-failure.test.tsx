/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageToggleIsland, MobileNavigationIsland } from "../header-client";

const mockPathname = vi.hoisted(() => ({ current: "/products/widget" }));

vi.mock("@/i18n/routing", () => ({
  usePathname: () => mockPathname.current,
}));

beforeEach(() => {
  mockPathname.current = "/products/widget";
  window.history.replaceState(null, "", "/products/widget?ref=buyer#specs");
});

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

  it.each(["click", "hover"])(
    "keeps current-page locale links usable after %s activation fails",
    async (activation) => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const { rerender } = render(
        <LanguageToggleIsland ariaLabel="Language: English" locale="en" />,
      );

      await act(async () => {
        const trigger = screen.getByTestId("language-toggle-button");
        if (activation === "click") fireEvent.click(trigger);
        else fireEvent.pointerEnter(trigger);
        await vi.dynamicImportSettled();
      });

      fireEvent.click(
        screen.getByText("English", { selector: "summary span" }),
      );
      expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
        "href",
        "/products/widget?ref=buyer#specs",
      );
      expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
        "href",
        "/es/products/widget?ref=buyer#specs",
      );

      mockPathname.current = "/about";
      window.history.replaceState(null, "", "/about");
      rerender(
        <LanguageToggleIsland ariaLabel="Language: Español" locale="es" />,
      );
      expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
        "href",
        "/about",
      );
      expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
        "href",
        "/es/about",
      );
      consoleError.mockRestore();
    },
  );
});
