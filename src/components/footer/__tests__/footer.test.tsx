/**
 * Footer Component Tests
 *
 * Covers the hairline three-column footer with legal identity bar
 * (docs/design/设计真相.md).
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "@/components/footer/footer";
import {
  SINGLE_SITE_CONFIG,
  SINGLE_SITE_FACTS,
  SINGLE_SITE_FOOTER_COLUMNS,
} from "@/config/single-site";
import { getSourceMessages } from "@/lib/i18n/load-messages";
import {
  getSiteMessageValues,
  type SiteMessageValues,
} from "@/lib/i18n/site-message-values";

const siteValues = await getSiteMessageValues();

function readMessageValue(
  messages: Record<string, unknown>,
  path: string,
): string | undefined {
  const value = path.split(".").reduce<unknown>((current, segment) => {
    if (
      typeof current !== "object" ||
      current === null ||
      Array.isArray(current)
    ) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, messages);

  if (typeof value !== "string") {
    return undefined;
  }

  return value.replace(
    /\{(siteName|companyName|currentYear)\}/gu,
    (match, key: string) => siteValues[key as keyof SiteMessageValues] ?? match,
  );
}

function createNextIntlLikeTranslator(messages: Record<string, unknown>) {
  const translate = ((key: string) => {
    const value = readMessageValue(messages, key);
    return value ?? key;
  }) as ((key: string) => string) & { has: (key: string) => boolean };

  translate.has = (key: string) =>
    readMessageValue(messages, key) !== undefined;

  return translate;
}

const sourceMessages = getSourceMessages("en");

const { mockUseTranslations } = vi.hoisted(() => ({
  mockUseTranslations: vi.fn(() =>
    createNextIntlLikeTranslator(sourceMessages),
  ),
}));

vi.mock("next-intl", () => ({
  useTranslations: mockUseTranslations,
}));

describe("Footer Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseTranslations.mockImplementation(() =>
      createNextIntlLikeTranslator(sourceMessages),
    );
  });

  it("renders without crashing", () => {
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("keeps footer navigation aligned with the neutral core IA", () => {
    render(<Footer />);

    const footerNav = screen.getByRole("navigation", {
      name: /footer navigation/i,
    });
    const navigationSection = footerNav
      .querySelector("#navigation-heading")
      ?.closest("section");
    const supportSection = footerNav
      .querySelector("#support-heading")
      ?.closest("section");

    expect(navigationSection).not.toBeNull();
    expect(supportSection).not.toBeNull();

    const navigationLinks = Array.from(
      navigationSection?.querySelectorAll("a") ?? [],
    ).map((link) => ({
      href: link.getAttribute("href"),
      text: link.textContent,
    }));
    expect(navigationLinks).toEqual([
      { href: "/", text: "Home" },
      { href: "/products", text: "Products" },
      { href: "/about", text: "About" },
      { href: "/contact", text: "Contact" },
    ]);
  });

  it("throws with the full message path when footer.copyright is missing", () => {
    const incompleteMessages = structuredClone(sourceMessages);
    delete (incompleteMessages.footer as Record<string, unknown>).copyright;

    mockUseTranslations.mockImplementation(() =>
      createNextIntlLikeTranslator(incompleteMessages),
    );

    expect(() => render(<Footer />)).toThrow(
      "Missing required message: footer.copyright",
    );
  });

  it("throws with the full message path when a footer config translation key is missing", () => {
    const incompleteMessages = structuredClone(sourceMessages);
    const footerMessages = incompleteMessages.footer;
    if (
      typeof footerMessages !== "object" ||
      footerMessages === null ||
      Array.isArray(footerMessages)
    ) {
      throw new Error("Expected footer messages to be an object");
    }

    const sections = (
      footerMessages as {
        sections?: { navigation?: { title?: unknown } };
      }
    ).sections;
    if (!sections?.navigation) {
      throw new Error("Expected footer.sections.navigation messages");
    }

    delete sections.navigation.title;

    mockUseTranslations.mockImplementation(() =>
      createNextIntlLikeTranslator(incompleteMessages),
    );

    expect(() => render(<Footer />)).toThrow(
      "Missing required message: footer.sections.navigation.title",
    );
  });

  it("renders the brand wordmark with an accessible site name", () => {
    render(<Footer />);

    expect(
      screen.getByText(SINGLE_SITE_CONFIG.name, { selector: ".sr-only" }),
    ).toBeInTheDocument();
  });

  it("renders the legal identity bar from single-site config", () => {
    render(<Footer />);

    expect(
      screen.getByText(
        `${SINGLE_SITE_FACTS.company.name} · ${SINGLE_SITE_CONFIG.contact.email}`,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        (content) =>
          content.startsWith("© ") && content.includes("All rights reserved"),
      ),
    ).toBeInTheDocument();
  });

  it("uses footer-specific color tokens for the flat footer surface", () => {
    render(<Footer />);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveClass(
      "bg-[var(--footer-bg)]",
      "border-[var(--footer-divider)]",
    );

    const firstHeading = screen.getAllByRole("heading", { level: 2 })[0];
    expect(firstHeading).toHaveClass("text-[var(--footer-heading)]");

    const firstLink = screen.getAllByRole("link")[0];
    expect(firstLink).toHaveClass(
      "text-[var(--footer-text)]",
      "hover:text-[var(--primary-text)]",
    );
  });

  it("keeps links block-level with padded touch targets", () => {
    render(<Footer />);

    const firstLink = screen.getAllByRole("link")[0];
    expect(firstLink).toHaveClass("block", "py-1.5");
  });

  it("renders theme toggle slot in the legal bar when provided", () => {
    render(<Footer themeToggleSlot={<button>Toggle Theme</button>} />);
    expect(screen.getByText("Toggle Theme")).toBeInTheDocument();
  });

  it("applies custom className and data-theme", () => {
    const { container } = render(
      <Footer className="custom-footer" dataTheme="dark" />,
    );
    const footer = container.querySelector(".custom-footer");
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveAttribute("data-theme", "dark");
  });

  it("uses the formal footer column configuration", () => {
    render(<Footer />);

    expect(SINGLE_SITE_FOOTER_COLUMNS.map((column) => column.key)).toEqual([
      "navigation",
      "support",
    ]);
  });
});
