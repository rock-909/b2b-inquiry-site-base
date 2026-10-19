import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import messages from "../../../../messages/base/en/messages.json";
import HomePage, { generateMetadata } from "@/app/[locale]/page";
import { LOCALES_CONFIG } from "@/config/paths";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { getFlatMessages } from "@/test/i18n-messages";

vi.mock("@/components/seo/json-ld-script", () => ({
  JsonLdGraphScript: () => null,
}));

const { defaultLocale, locales } = LOCALES_CONFIG;
const urlFor = (path: string) =>
  new URL(path, SINGLE_SITE_CONFIG.baseUrl).toString();
const homePathFor = (locale: string) =>
  locale === defaultLocale ? "/" : `/${locale}`;

describe("home page", () => {
  it("renders a localized heading and ordinary contact link without a form", async () => {
    render(await HomePage({ params: Promise.resolve({ locale: "en" }) }));
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      messages.home.title,
    );
    expect(
      screen.getByRole("link", { name: messages.home.contactLink }),
    ).toHaveAttribute("href", "/contact");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
});

describe("home page metadata", () => {
  it.each(locales)(
    "takes %s search and social metadata from that locale's home messages",
    async (locale) => {
      const localeMessages = getFlatMessages(locale);
      const metadata = await generateMetadata({
        params: Promise.resolve({ locale }),
      });

      expect(metadata.title).toBe(SINGLE_SITE_CONFIG.name);
      expect(metadata.description).toBe(
        localeMessages.get("home.metadata.description"),
      );
      expect(metadata.openGraph).toMatchObject({
        title: metadata.title,
        description: metadata.description,
        siteName: SINGLE_SITE_CONFIG.name,
        locale: expect.stringContaining(`${locale}_`),
      });
      expect(metadata.twitter).toMatchObject({
        title: metadata.title,
        description: metadata.description,
      });
      expect(metadata.alternates).toMatchObject({
        canonical: urlFor(homePathFor(locale)),
        languages: {
          ...Object.fromEntries(
            locales.map((entry) => [entry, urlFor(homePathFor(entry))]),
          ),
          "x-default": urlFor("/"),
        },
      });
    },
  );
});
