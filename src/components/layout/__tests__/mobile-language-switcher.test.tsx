/**
 * @vitest-environment jsdom
 */

import type { ComponentProps } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, expect, it } from "vitest";
import { MobileLanguageSwitcher } from "@/components/layout/mobile-language-switcher";

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

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href, ...props }: ComponentProps<"a">) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
  usePathname: () => "/products",
}));

describe("MobileLanguageSwitcher", () => {
  it("shows the current language and expands without inventing another locale", async () => {
    const user = userEvent.setup();
    render(<MobileLanguageSwitcher locale="en" />);

    const trigger = screen.getByTestId("mobile-language-trigger");
    expect(trigger).toHaveAccessibleName("Language: English");
    expect(trigger).toHaveTextContent("Language");
    expect(trigger).toHaveTextContent("English");

    await user.click(trigger);

    const currentOption = screen.getByTestId("mobile-language-option-en");
    expect(currentOption).toHaveAttribute("aria-current", "true");
    expect(currentOption).toHaveClass("bg-transparent", "text-foreground");
    expect(currentOption.querySelector('[lang="en"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();
  });
});
