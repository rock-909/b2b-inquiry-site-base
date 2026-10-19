/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageToggleIsland, MobileNavigationIsland } from "../header-client";
import { captureExpectedConsoleErrors } from "@/test/console";
import { DEFAULT_LOCALE, OTHER_LOCALE } from "@/test/two-locales";

vi.hoisted(() => vi.resetModules());
vi.mock("@/config/paths/locales-config", () => import("@/test/two-locales"));

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

// 分块加载失败是本文件故意制造的：边界用 logger 记录一次，React 开发模式对被
// 边界捕获的错误再打印一次（格式串 "%o\n\n%s\n\n%s"）。其他 error 仍交给全局闸门。
function captureExpectedChunkFailureLogs() {
  return captureExpectedConsoleErrors(
    "Lazy island failed to load",
    "%o\n\n%s\n\n%s",
  );
}

describe("header islands when their chunk fails to load", () => {
  it("keeps the native mobile navigation links usable", async () => {
    const consoleError = captureExpectedChunkFailureLogs();

    render(
      <MobileNavigationIsland
        siteName="Test Site"
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
      const consoleError = captureExpectedChunkFailureLogs();

      const { rerender } = render(
        <LanguageToggleIsland
          ariaLabel="Language: English"
          locale={DEFAULT_LOCALE}
        />,
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
      expect(screen.getByRole("link", { name: "Deutsch" })).toHaveAttribute(
        "href",
        "/de/contact?ref=buyer#specs",
      );

      mockPathname.current = "/privacy";
      window.history.replaceState(null, "", "/privacy");
      rerender(
        <LanguageToggleIsland
          ariaLabel="Language: Deutsch"
          locale={OTHER_LOCALE}
        />,
      );
      expect(screen.getByRole("link", { name: "English" })).toHaveAttribute(
        "href",
        "/privacy",
      );
      expect(screen.getByRole("link", { name: "Deutsch" })).toHaveAttribute(
        "href",
        "/de/privacy",
      );
      consoleError.mockRestore();
    },
  );
});
