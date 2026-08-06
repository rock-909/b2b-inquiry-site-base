import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import LocaleNotFound from "../not-found";

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: "Page not found",
      description:
        "The page you're looking for doesn't exist or has been moved.",
      goHome: "Back to homepage",
    };
    return translations[key] || key;
  },
}));

// Mock Button component
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild,
  }: React.PropsWithChildren<{ asChild?: boolean }>) => (
    <button data-testid="home-button" data-as-child={asChild}>
      {children}
    </button>
  ),
}));

// Mock Link component
vi.mock("@/i18n/routing", () => ({
  Link: ({ children, href }: React.PropsWithChildren<{ href: string }>) => (
    <a href={href} data-testid="home-link">
      {children}
    </a>
  ),
}));

async function renderLocaleNotFound() {
  render(<LocaleNotFound />);
}

describe("LocaleNotFound", () => {
  describe("rendering", () => {
    it("should render 404 text", async () => {
      await renderLocaleNotFound();

      expect(screen.getByText("404")).toBeInTheDocument();
    });

    it("should render page title", async () => {
      await renderLocaleNotFound();

      expect(screen.getByText("Page not found")).toBeInTheDocument();
    });

    it("should render description", async () => {
      await renderLocaleNotFound();

      expect(
        screen.getByText(
          "The page you're looking for doesn't exist or has been moved.",
        ),
      ).toBeInTheDocument();
    });

    it("should render back to homepage button", async () => {
      await renderLocaleNotFound();

      expect(screen.getByText("Back to homepage")).toBeInTheDocument();
    });

    it("should have link to homepage", async () => {
      await renderLocaleNotFound();

      const link = screen.getByTestId("home-link");
      expect(link).toHaveAttribute("href", "/");
    });
  });

  describe("structure", () => {
    it("should have centered layout container", async () => {
      const { container } = render(<LocaleNotFound />);

      const mainContainer = container.querySelector(".flex.min-h-\\[60vh\\]");
      expect(mainContainer).toBeInTheDocument();
    });

    it("should have max-width container for content", async () => {
      const { container } = render(<LocaleNotFound />);

      const contentContainer = container.querySelector(".max-w-lg");
      expect(contentContainer).toBeInTheDocument();
    });

    it("should render h1 heading", async () => {
      await renderLocaleNotFound();

      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent("Page not found");
    });
  });

  describe("accessibility", () => {
    it("should have proper heading hierarchy", async () => {
      await renderLocaleNotFound();

      const headings = screen.getAllByRole("heading");
      expect(headings).toHaveLength(1);
      expect(headings[0]).toHaveTextContent("Page not found");
    });

    it("should have accessible button", async () => {
      await renderLocaleNotFound();

      const button = screen.getByTestId("home-button");
      expect(button).toBeInTheDocument();
    });
  });
});
