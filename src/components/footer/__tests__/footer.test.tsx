import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PUBLIC_STATIC_PAGE_DEFINITIONS } from "@/config/pages.config";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { Footer } from "../footer";

describe("Footer", () => {
  const template = structuredClone(SINGLE_SITE_CONFIG);
  afterEach(() => {
    Object.assign(SINGLE_SITE_CONFIG, structuredClone(template));
  });

  it("shows only the site name and copyright when no company facts are configured", () => {
    const { container } = render(<Footer />);
    expect(
      screen.getByText(`© ${new Date().getFullYear()} ${template.name}`),
    ).toBeInTheDocument();
    expect(container.querySelector("address")).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Connect" }),
    ).not.toBeInTheDocument();
  });

  it("shows the configured company name, contact links, address and social column", () => {
    Object.assign(SINGLE_SITE_CONFIG, {
      company: {
        name: "Acme Valves S.L.",
        location: { address: "Calle Mayor 1", city: "Valencia", country: "ES" },
      },
      contact: {
        email: "sales@acme.com",
        phone: "+34 960 123 456",
        whatsapp: "+34 600 123 456",
      },
      social: {
        linkedin: "https://www.linkedin.com/company/acme",
        twitter: "",
      },
    });
    const { container } = render(<Footer />);
    const address = container.querySelector("address") as HTMLElement;
    expect(
      screen.getByText(`© ${new Date().getFullYear()} Acme Valves S.L.`),
    ).toBeInTheDocument();
    expect(
      within(address)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual([
      "mailto:sales@acme.com",
      "tel:+34 960 123 456",
      "https://wa.me/34600123456",
    ]);
    expect(address).toHaveTextContent("Calle Mayor 1, Valencia, ES");
    expect(
      screen.getByRole("heading", { name: "Connect" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "LinkedIn" }).getAttribute("href"),
    ).toBe("https://www.linkedin.com/company/acme");
  });

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

  it("offers cookie settings only when analytics is configured", () => {
    const { unmount } = render(<Footer />);
    expect(
      screen.queryByRole("button", { name: "Cookie settings" }),
    ).not.toBeInTheDocument();
    unmount();

    vi.stubEnv("NEXT_PUBLIC_GA_MEASUREMENT_ID", "G-TEST");
    render(<Footer />);
    expect(
      screen.getByRole("button", { name: "Cookie settings" }),
    ).toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
