/**
 * @vitest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, vi, describe, expect, it } from "vitest";
import { HeaderLanguageMenu } from "@/components/layout/header-language-menu";
import { DEFAULT_LOCALE, OTHER_LOCALE } from "@/test/two-locales";

vi.hoisted(() => vi.resetModules());
vi.mock("@/config/paths/locales-config", () => import("@/test/two-locales"));

const mockPathname = vi.hoisted(() => ({ current: "/contact" }));

vi.mock("@/i18n/routing", () => ({
  FinalUrlLink: (props: ComponentProps<"a">) => <a {...props} />,
  usePathname: () => mockPathname.current,
}));

describe("HeaderLanguageMenu", () => {
  beforeEach(() => {
    mockPathname.current = "/contact";
    window.history.replaceState({}, "", "/contact");
  });

  it("opens from pointer hover", async () => {
    const user = userEvent.setup();
    render(<HeaderLanguageMenu locale={DEFAULT_LOCALE} />);

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
    render(<HeaderLanguageMenu initialOpen locale={DEFAULT_LOCALE} />);

    expect(
      screen.getByRole("button", { name: "Languages: English" }),
    ).toHaveAttribute("aria-expanded", "true");

    const currentOption = await screen.findByTestId("language-option-en");
    expect(currentOption).toHaveAttribute("aria-current", "true");
    expect(currentOption).toHaveAttribute("aria-disabled", "true");
    expect(currentOption).toHaveTextContent("English");
    expect(currentOption.querySelector('[lang="en"]')).not.toBeNull();
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();
  });

  it("keeps query values and the hash on the locale link", async () => {
    window.history.replaceState(
      {},
      "",
      "/contact?source=trade-show&tag=one&tag=two#inquiry",
    );
    render(<HeaderLanguageMenu initialOpen locale={DEFAULT_LOCALE} />);

    const otherLink = await screen.findByRole("menuitem", {
      name: "Deutsch",
    });
    expect(otherLink).toHaveAttribute("data-locale", "de");
    expect(otherLink).toHaveAttribute("hreflang", "de");
    expect(otherLink).toHaveAttribute(
      "href",
      "/de/contact?source=trade-show&tag=one&tag=two#inquiry",
    );
  });

  it("links directly to the unprefixed default locale without losing the hash", async () => {
    window.history.replaceState(
      {},
      "",
      "/de/contact?source=trade-show&tag=one&tag=two#inquiry",
    );
    render(<HeaderLanguageMenu initialOpen locale={OTHER_LOCALE} />);

    expect(
      await screen.findByRole("menuitem", { name: "English" }),
    ).toHaveAttribute(
      "href",
      "/contact?source=trade-show&tag=one&tag=two#inquiry",
    );
  });

  it("stays closed after navigating away and returning to the activation route", async () => {
    const { rerender } = render(
      <HeaderLanguageMenu initialOpen locale={DEFAULT_LOCALE} />,
    );

    expect(
      screen.getByRole("button", { name: "Languages: English" }),
    ).toHaveAttribute("aria-expanded", "true");

    mockPathname.current = "/privacy";
    rerender(<HeaderLanguageMenu initialOpen locale={DEFAULT_LOCALE} />);
    expect(
      screen.getByRole("button", { name: "Languages: English" }),
    ).toHaveAttribute("aria-expanded", "false");

    mockPathname.current = "/contact";
    rerender(<HeaderLanguageMenu initialOpen locale={DEFAULT_LOCALE} />);
    expect(
      screen.getByRole("button", { name: "Languages: English" }),
    ).toHaveAttribute("aria-expanded", "false");
  });
});
