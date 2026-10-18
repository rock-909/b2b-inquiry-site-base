import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Footer } from "../footer";

describe("Footer", () => {
  it("keeps core links and theme control without placeholder contact details", () => {
    render(<Footer themeToggleSlot={<button>Toggle Theme</button>} />);
    const nav = screen.getByRole("navigation", { name: /footer navigation/i });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/", "/contact", "/privacy", "/terms"]);
    expect(
      screen.getByRole("button", { name: "Toggle Theme" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/example.invalid/)).not.toBeInTheDocument();
  });
});
