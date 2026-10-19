import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { Footer } from "../footer";

describe("Footer", () => {
  it("keeps core links and theme control without placeholder contact details", () => {
    render(<Footer themeToggleSlot={<button>Toggle Theme</button>} />);
    const nav = screen.getByRole("navigation", { name: /footer navigation/i });
    const hrefs = within(nav)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"));
    expect(hrefs).toEqual([
      ...PUBLIC_STATIC_PAGE_DEFINITIONS.filter(
        (page) => page.navigationKey !== null,
      ).map((page) => page.path),
      "/privacy",
      "/terms",
    ]);
    expect(hrefs[0]).toBe("/");
    expect(
      screen.getByRole("button", { name: "Toggle Theme" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/example.invalid/)).not.toBeInTheDocument();
  });
});
