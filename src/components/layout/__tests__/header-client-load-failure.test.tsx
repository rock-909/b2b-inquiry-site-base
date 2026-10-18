/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageToggleIsland, MobileNavigationIsland } from "../header-client";

const mockPathname = vi.hoisted(() => ({ current: "/contact" }));

vi.mock("@/i18n/routing", () => ({
  usePathname: () => mockPathname.current,
}));

beforeEach(() => {
  mockPathname.current = "/contact";
  window.history.replaceState(null, "", "/contact?ref=buyer#specs");
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
        <a href="/contact">Contact</a>
      </MobileNavigationIsland>,
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId("header-mobile-menu-button"));
      await vi.dynamicImportSettled();
    });

    expect(screen.getByTestId("header-mobile-menu-button")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "/contact",
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
        "/contact?ref=buyer#specs",
      );
      expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
        "href",
        "/es/contact?ref=buyer#specs",
      );

      mockPathname.current = "/privacy";
      window.history.replaceState(null, "", "/privacy");
      rerender(
        <LanguageToggleIsland ariaLabel="Language: Español" locale="es" />,
      );
      expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
        "href",
        "/privacy",
      );
      expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
        "href",
        "/es/privacy",
      );
      consoleError.mockRestore();
    },
  );
});
