/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, vi, describe, expect, it } from "vitest";
import { HeaderLanguageMenu } from "@/components/layout/header-language-menu";

vi.mock("next-intl", () => ({
  useTranslations:
    (namespace: string) => (key: string, values?: Record<string, string>) => {
      if (namespace === "accessibility" && key === "language") {
        return `Languages: ${values?.language ?? ""}`;
      }
      if (namespace === "navigation" && key === "language") {
        return "Languages";
      }
      return `${namespace}.${key}`;
    },
}));

const mockPathname = vi.hoisted(() => ({ current: "/products" }));

vi.mock("@/i18n/routing", () => ({
  FinalUrlLink: (props: ComponentProps<"a">) => <a {...props} />,
  usePathname: () => mockPathname.current,
}));

describe("HeaderLanguageMenu", () => {
  beforeEach(() => {
    mockPathname.current = "/products";
    window.history.replaceState({}, "", "/products");
  });

  it("opens from pointer hover", async () => {
    const user = userEvent.setup();
    render(<HeaderLanguageMenu locale="en" />);

    const trigger = screen.getByRole("button", {
      name: "Languages: English",
    });
    await user.hover(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
    expect(screen.getByTestId("language-dropdown-content")).toBeInTheDocument();
  });

  it("opens with the current language clearly marked and no fake switch link", async () => {
    render(<HeaderLanguageMenu initialOpen locale="en" />);

    expect(
      screen.getByRole("button", { name: "Languages: English" }),
    ).toHaveAttribute("aria-expanded", "true");

    const currentOption = await screen.findByTestId("language-option-en");
    expect(currentOption).toHaveAttribute("aria-current", "true");
    expect(currentOption).toHaveAttribute("aria-disabled", "true");
    expect(currentOption).toHaveTextContent("English");
    expect(currentOption).toHaveClass("text-foreground");
    expect(currentOption.querySelector('[lang="en"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();
  });

  it("keeps query values and the hash on the locale link", async () => {
    window.history.replaceState(
      {},
      "",
      "/products?source=trade-show&tag=one&tag=two#inquiry",
    );
    render(<HeaderLanguageMenu initialOpen locale="en" />);

    const spanishLink = await screen.findByRole("menuitem", {
      name: "Español",
    });
    expect(spanishLink).toHaveAttribute("data-locale", "es");
    expect(spanishLink).toHaveAttribute("hreflang", "es");
    expect(spanishLink).toHaveAttribute(
      "href",
      "/es/products?source=trade-show&tag=one&tag=two#inquiry",
    );
  });

  it("links directly to the unprefixed default locale without losing the hash", async () => {
    window.history.replaceState(
      {},
      "",
      "/es/products?source=trade-show&tag=one&tag=two#inquiry",
    );
    render(<HeaderLanguageMenu initialOpen locale="es" />);

    expect(
      await screen.findByRole("menuitem", { name: "English" }),
    ).toHaveAttribute(
      "href",
      "/products?source=trade-show&tag=one&tag=two#inquiry",
    );
  });

  it("stays closed after navigating away and returning to the activation route", async () => {
    const { rerender } = render(<HeaderLanguageMenu initialOpen locale="en" />);

    expect(
      screen.getByRole("button", { name: "Languages: English" }),
    ).toHaveAttribute("aria-expanded", "true");

    mockPathname.current = "/about";
    rerender(<HeaderLanguageMenu initialOpen locale="en" />);
    expect(
      screen.getByRole("button", { name: "Languages: English" }),
    ).toHaveAttribute("aria-expanded", "false");

    mockPathname.current = "/products";
    rerender(<HeaderLanguageMenu initialOpen locale="en" />);
    expect(
      screen.getByRole("button", { name: "Languages: English" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
