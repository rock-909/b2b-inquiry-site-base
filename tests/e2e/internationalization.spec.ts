import { getSitePageCases } from "./site-page-cases";
import {
  getOfferingPath,
  getOfferingsForLocale,
} from "../../src/config/offerings";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  expectHtmlLang,
  getHeaderMobileMenuButton,
} from "./helpers/navigation";

const SPANISH_PAGES = [
  ...getSitePageCases("es"),
  ...getOfferingsForLocale("es").map(
    (offering) =>
      [`/es${getOfferingPath(offering.id)}`, offering.name] as const,
  ),
];

const INQUIRY_DRAFT = {
  fullName: "Language Switch Buyer",
  email: "language-switch@example.com",
  message: "Keep this inquiry while switching languages.",
} as const;

interface InquiryFields {
  email: Locator;
  fullName: Locator;
  message: Locator;
}

async function getEditableInquiryFields(page: Page): Promise<InquiryFields> {
  await page
    .getByTestId("contact-form-column")
    .scrollIntoViewIfNeeded({ timeout: 5_000 });

  const fields = {
    fullName: page.locator('input[name="fullName"]'),
    email: page.locator('input[name="email"]'),
    message: page.locator('textarea[name="message"]'),
  };
  await expect(fields.fullName).toBeEditable({ timeout: 15_000 });

  return fields;
}

async function fillInquiryDraft(fields: InquiryFields): Promise<void> {
  await fields.fullName.fill(INQUIRY_DRAFT.fullName);
  await fields.email.fill(INQUIRY_DRAFT.email);
  await fields.message.fill(INQUIRY_DRAFT.message);
}

async function expectInquiryDraft(fields: InquiryFields): Promise<void> {
  await expect(fields.fullName).toHaveValue(INQUIRY_DRAFT.fullName);
  await expect(fields.email).toHaveValue(INQUIRY_DRAFT.email);
  await expect(fields.message).toHaveValue(INQUIRY_DRAFT.message);
}

function expectContactUrl(page: Page, pathname: string): void {
  const url = new URL(page.url());
  expect(url.pathname).toBe(pathname);
  expect(url.searchParams.get("source")).toBe("language-e2e");
  expect(url.searchParams.getAll("tag")).toEqual(["one", "two"]);
  expect(url.hash).toBe("#inquiry");
}

test.describe("Spanish locale contract", () => {
  for (const [path, heading] of SPANISH_PAGES) {
    test(`${path} renders a complete Spanish page`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response?.status(), `${path} should return HTTP 200`).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", "es");
      await expect(
        page.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      expect(
        new URL((await canonical.getAttribute("href")) ?? "").pathname,
      ).toBe(path);

      for (const [language, expectedPath] of [
        ["en", path.replace(/^\/es(?=\/|$)/u, "") || "/"],
        ["es", path],
        ["x-default", path.replace(/^\/es(?=\/|$)/u, "") || "/"],
      ] as const) {
        const alternate = page.locator(
          `link[rel="alternate"][hreflang="${language}"]`,
        );
        await expect(alternate).toHaveCount(1);
        expect(
          new URL((await alternate.getAttribute("href")) ?? "").pathname,
        ).toBe(expectedPath);
      }
    });
  }

  test("/es/contact localizes unconfigured business hours", async ({
    page,
  }) => {
    await page.goto("/es/contact", { waitUntil: "domcontentloaded" });

    const hours = page
      .getByRole("heading", { name: "Horario comercial" })
      .locator("..");

    await expect(hours).toContainText("Días laborables");
    await expect(hours).toContainText("Sábado");
    await expect(hours).toContainText("Definir antes del lanzamiento");
    await expect(hours).not.toContainText("Replace before launch");
  });
});

test.describe("Language switcher journey", () => {
  test("desktop switch preserves the URL, inquiry draft, and keyboard lifecycle", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto("/contact?source=language-e2e&tag=one&tag=two#inquiry", {
      waitUntil: "domcontentloaded",
    });

    await fillInquiryDraft(await getEditableInquiryFields(page));
    await page.evaluate(() => window.scrollTo(0, 0));

    const trigger = page.getByRole("button", {
      name: "Languages: English",
    });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByTestId("language-option-en")).toHaveAttribute(
      "aria-current",
      "true",
    );

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();

    await trigger.click();
    const spanish = page.getByRole("menuitem", { name: "Español" });
    await expect(spanish).toHaveAttribute(
      "href",
      "/es/contact?source=language-e2e&tag=one&tag=two#inquiry",
    );
    await page.evaluate(() => Reflect.set(window, "__languageE2E", true));
    await spanish.click();

    await expectHtmlLang(page, "es");
    expectContactUrl(page, "/es/contact");
    expect(
      await page.evaluate(() => Reflect.get(window, "__languageE2E")),
    ).toBe(true);
    await expectInquiryDraft(await getEditableInquiryFields(page));
    await expect(
      page.getByRole("button", { name: "Idiomas: Español" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(pageErrors).toEqual([]);
  });

  test.describe("mobile", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("switches to the final default-locale URL and restores the drawer and draft", async ({
      page,
    }) => {
      const pageErrors: string[] = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await page.goto(
        "/es/contact?source=language-e2e&tag=one&tag=two#inquiry",
        { waitUntil: "domcontentloaded" },
      );

      await fillInquiryDraft(await getEditableInquiryFields(page));
      await page.evaluate(() => window.scrollTo(0, 0));

      const mobileTrigger = getHeaderMobileMenuButton(page);
      await mobileTrigger.click();
      const drawer = page.getByRole("dialog", {
        name: /navegación móvil/i,
      });
      await expect(drawer).toBeVisible();
      await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

      await page.getByTestId("mobile-language-trigger").click();
      const english = drawer.getByRole("link", { name: "English" });
      await expect(english).toHaveAttribute(
        "href",
        "/contact?source=language-e2e&tag=one&tag=two#inquiry",
      );
      await english.click();

      await expectHtmlLang(page, "en");
      expectContactUrl(page, "/contact");
      await expect(drawer).not.toBeVisible();
      await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
      await expectInquiryDraft(await getEditableInquiryFields(page));
      expect(pageErrors).toEqual([]);
    });
  });
});
