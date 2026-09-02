/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, vi, describe, expect, it } from "vitest";
import { MobileLanguageSwitcher } from "@/components/layout/mobile-language-switcher";

type MockFinalUrlLinkProps = ComponentProps<"a"> & {
  onNavigate?: () => void;
};

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

vi.mock("@/i18n/routing", () => ({
  FinalUrlLink: ({ onNavigate, ...props }: MockFinalUrlLinkProps) => (
    <a
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        onNavigate?.();
      }}
    />
  ),
  usePathname: () => "/products",
}));

describe("MobileLanguageSwitcher", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/products");
  });

  it("shows the current language and a real Spanish switch target", async () => {
    const user = userEvent.setup();
    render(<MobileLanguageSwitcher locale="en" />);

    const trigger = screen.getByTestId("mobile-language-trigger");
    expect(trigger).toHaveAccessibleName("Languages: English");
    expect(trigger).toHaveTextContent("Languages");
    expect(trigger).toHaveTextContent("English");

    await user.click(trigger);

    expect(screen.queryByTestId("mobile-language-option-en")).toBeNull();
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();
    expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
      "lang",
      "es",
    );
  });

  it("keeps query values and the hash on the mobile locale link", async () => {
    window.history.replaceState(
      {},
      "",
      "/products?source=mobile&tag=one&tag=two#inquiry",
    );
    const user = userEvent.setup();
    render(<MobileLanguageSwitcher locale="en" />);

    await user.click(screen.getByTestId("mobile-language-trigger"));

    expect(screen.getByRole("link", { name: "Español" })).toHaveAttribute(
      "href",
      "/es/products?source=mobile&tag=one&tag=two#inquiry",
    );
  });

  it("closes the parent navigation after Next accepts the locale navigation", async () => {
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    render(<MobileLanguageSwitcher locale="en" onNavigate={onNavigate} />);

    await user.click(screen.getByTestId("mobile-language-trigger"));
    await user.click(screen.getByRole("link", { name: "Español" }));

    expect(onNavigate).toHaveBeenCalledOnce();
  });
});
