import type React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CatchAllSegmentNotFound from "../not-found";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: "Page not found",
      description: "The page does not exist.",
      goHome: "Back to homepage",
    };
    return translations[key] ?? key;
  },
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children }: React.PropsWithChildren<{ asChild?: boolean }>) => (
    <>{children}</>
  ),
}));

vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href}>{children}</a>
  ),
}));

describe("CatchAllSegmentNotFound", () => {
  it("renders the shared localized not-found view in the catch-all segment", () => {
    render(<CatchAllSegmentNotFound />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to homepage" }),
    ).toHaveAttribute("href", "/");
  });
});
