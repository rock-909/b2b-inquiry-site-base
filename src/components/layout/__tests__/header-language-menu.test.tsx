/**
 * @vitest-environment jsdom
 */

import type { ComponentProps } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, expect, it } from "vitest";
import { HeaderLanguageMenu } from "@/components/layout/header-language-menu";

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, string>) => {
      if (namespace === "accessibility" && key === "language") {
        return `Language: ${values?.language ?? ""}`;
      }
      if (namespace === "navigation" && key === "language") {
        return "Language";
      }
      return `${namespace}.${key}`;
    },
}));

const mockPathname = vi.hoisted(() => ({ current: "/products" }));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
  usePathname: () => mockPathname.current,
}));

describe("HeaderLanguageMenu", () => {
  it("opens from pointer hover", async () => {
    const user = userEvent.setup();
    render(<HeaderLanguageMenu locale="en" />);

    const trigger = screen.getByRole("button", { name: "Language: English" });
    await user.hover(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByTestId("language-dropdown-content")).toBeInTheDocument();
  });

  it("opens with the current language clearly marked and no fake switch link", async () => {
    render(<HeaderLanguageMenu initialOpen locale="en" />);

    expect(
      screen.getByRole("button", { name: "Language: English" }),
    ).toHaveAttribute("aria-expanded", "true");

    const currentOption = await screen.findByTestId("language-option-en");
    expect(currentOption).toHaveAttribute("aria-current", "true");
    expect(currentOption).toHaveTextContent("English");
    expect(currentOption).toHaveClass("text-foreground");
    expect(currentOption).toHaveClass("data-[highlighted]:bg-transparent");
    expect(currentOption.querySelector('[lang="en"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();
  });

  it("stays closed after navigating away and returning to the activation route", async () => {
    const { rerender } = render(<HeaderLanguageMenu initialOpen locale="en" />);

    expect(
      screen.getByRole("button", { name: "Language: English" }),
    ).toHaveAttribute("aria-expanded", "true");

    mockPathname.current = "/about";
    rerender(<HeaderLanguageMenu initialOpen locale="en" />);
    expect(
      screen.getByRole("button", { name: "Language: English" }),
    ).toHaveAttribute("aria-expanded", "false");

    mockPathname.current = "/products";
    rerender(<HeaderLanguageMenu initialOpen locale="en" />);
    expect(
      screen.getByRole("button", { name: "Language: English" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
