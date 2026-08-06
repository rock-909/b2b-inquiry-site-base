import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

const themeLabels: Record<string, string> = {
  switchToLight: "Switch to light theme",
  switchToDark: "Switch to dark theme",
  switchToSystem: "Switch to system theme",
};

const accessibilityLabels: Record<string, string> = {
  themeSelector: "TEST theme selector group",
};

function mockThemeTranslations(namespace?: string) {
  if (namespace === "accessibility") {
    return ((key: string) => accessibilityLabels[key] ?? key) as ReturnType<
      typeof useTranslations
    >;
  }

  return ((key: string) => themeLabels[key] ?? key) as ReturnType<
    typeof useTranslations
  >;
}

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    vi.mocked(useTranslations).mockImplementation((namespace?: string) =>
      mockThemeTranslations(namespace),
    );
  });

  it("keeps the idle-loaded switcher free of next/dynamic runtime", () => {
    const source = readFileSync("src/components/ui/theme-switcher.tsx", "utf8");

    expect(source).not.toContain("next/dynamic");
  });

  it("does not initialize hydration state from an effect", () => {
    const source = readFileSync("src/components/ui/theme-switcher.tsx", "utf8");

    expect(source).toContain("useSyncExternalStore");
    expect(source).not.toContain("setMounted");
  });

  it("renders the active theme highlight without a second dynamic boundary", async () => {
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

    expect(
      await screen.findByTestId("theme-switcher-highlight"),
    ).toBeInTheDocument();
  });

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
      name: "Switch to dark theme",
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
      name: "Switch to dark theme",
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
      name: "TEST theme selector group",
    });
    expect(group).toBeInTheDocument();

    await screen.findByTestId("theme-switcher-highlight");

    expect(
      screen.getByRole("button", { name: "Switch to dark theme" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Switch to light theme" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByRole("button", { name: "Switch to system theme" }),
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

  it("defaults data-testid to theme-toggle when not provided", async () => {
    const mockSetTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({
      theme: "light",
      setTheme: mockSetTheme,
      resolvedTheme: "light",
      themes: ["light", "dark", "system"],
      systemTheme: "light",
    });

    const { ThemeSwitcher } = await import("../theme-switcher");

    render(<ThemeSwitcher />);

    expect(await screen.findByTestId("theme-toggle")).toBeInTheDocument();
  });
});
