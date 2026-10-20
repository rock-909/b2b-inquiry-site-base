/**
 * @vitest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, vi, describe, expect, it } from "vitest";
import { MobileLanguageSwitcher } from "@/components/layout/mobile-language-switcher";
import { DEFAULT_LOCALE } from "@/test/two-locales";

vi.hoisted(() => vi.resetModules());
vi.mock("@/config/paths/locales-config", () => import("@/test/two-locales"));

vi.mock("@/i18n/routing", () => ({
  FinalUrlLink: (props: ComponentProps<"a">) => <a {...props} />,
  usePathname: () => "/contact",
}));

describe("MobileLanguageSwitcher", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/contact");
  });

  it("shows the current language and a real switch target for the other locale", async () => {
    const user = userEvent.setup();
    render(<MobileLanguageSwitcher locale={DEFAULT_LOCALE} />);

    const trigger = screen.getByTestId("mobile-language-trigger");
    expect(trigger).toHaveAccessibleName("Languages: English");
    expect(trigger).toHaveTextContent("Languages");
    expect(trigger).toHaveTextContent("English");

    await user.click(trigger);

    expect(screen.queryByTestId("mobile-language-option-en")).toBeNull();
    expect(screen.queryByRole("link", { name: "English" })).toBeNull();
    expect(screen.getByRole("link", { name: "Deutsch" })).toHaveAttribute(
      "lang",
      "de",
    );
  });

  it("keeps query values and the hash on the mobile locale link", async () => {
    window.history.replaceState(
      {},
      "",
      "/contact?source=mobile&tag=one&tag=two#inquiry",
    );
    const user = userEvent.setup();
    render(<MobileLanguageSwitcher locale={DEFAULT_LOCALE} />);

    await user.click(screen.getByTestId("mobile-language-trigger"));

    expect(screen.getByRole("link", { name: "Deutsch" })).toHaveAttribute(
      "href",
      "/de/contact?source=mobile&tag=one&tag=two#inquiry",
    );
  });
});
