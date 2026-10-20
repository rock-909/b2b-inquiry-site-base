import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTheme } from "next-themes";
import { describe, expect, it, vi } from "vitest";
import { createMockTranslations } from "@/test/utils";

// 文案取自真实消息包：断言的是每个 key 落在了哪个控件上。
const t = createMockTranslations();

describe("ThemeSwitcher", () => {
  it("uses resolvedTheme for the active highlight before theme is restored after navigation", async () => {
    const mockSetTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({
      theme: undefined,
      setTheme: mockSetTheme,
      resolvedTheme: "dark",
      themes: ["light", "dark", "system"],
      systemTheme: "dark",
    });

    const { ThemeSwitcher } = await import("../theme-switcher");

    render(<ThemeSwitcher data-testid="theme-switcher" />);

    const darkButton = screen.getByRole("button", {
      name: t("theme.switchToDark"),
    });

    expect(
      darkButton.querySelector('[data-testid="theme-switcher-highlight"]'),
    ).toBeInTheDocument();
  });

  it("calls setTheme when selecting a theme", async () => {
    const user = userEvent.setup();
    const mockSetTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
      resolvedTheme: "light",
      themes: ["light", "dark", "system"],
      systemTheme: "light",
    });

    const { ThemeSwitcher } = await import("../theme-switcher");

    render(<ThemeSwitcher data-testid="theme-switcher" />);

    // Wait for mounted state (skeleton renders disabled buttons first)
    await screen.findByTestId("theme-switcher-highlight");

    const darkButton = screen.getByRole("button", {
      name: t("theme.switchToDark"),
    });
    await user.click(darkButton);

    expect(mockSetTheme).toHaveBeenCalledWith("dark");
  });

  it("exposes translated group semantics and aria-pressed on the active option", async () => {
    const mockSetTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({
      theme: "dark",
      setTheme: mockSetTheme,
      resolvedTheme: "dark",
      themes: ["light", "dark", "system"],
      systemTheme: "dark",
    });

    const { ThemeSwitcher } = await import("../theme-switcher");

    render(<ThemeSwitcher data-testid="theme-switcher" />);

    const group = screen.getByRole("group", {
      name: t("accessibility.themeSelector"),
    });
    expect(group).toBeInTheDocument();

    await screen.findByTestId("theme-switcher-highlight");

    expect(
      screen.getByRole("button", { name: t("theme.switchToDark") }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: t("theme.switchToLight") }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: t("theme.switchToSystem") }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("omits aria-pressed from the disabled server-rendered skeleton", async () => {
    vi.mocked(useTheme).mockReturnValue({
      theme: undefined,
      setTheme: vi.fn(),
      resolvedTheme: undefined,
      themes: ["light", "dark", "system"],
      systemTheme: undefined,
    });

    const { ThemeSwitcher } = await import("../theme-switcher");
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<ThemeSwitcher />);
    const buttons = Array.from(container.querySelectorAll("button"));

    expect(buttons).toHaveLength(3);
    expect(buttons.every((button) => button.disabled)).toBe(true);
    expect(
      buttons.every((button) => !button.hasAttribute("aria-pressed")),
    ).toBe(true);
  });
});
