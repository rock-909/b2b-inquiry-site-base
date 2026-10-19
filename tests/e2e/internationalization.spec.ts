import {
  DEFAULT_LOCALE,
  getLocaleMessages,
  getSitePageCases,
  localePrefix,
  localizePath,
  SECOND_LOCALE,
} from "./site-page-cases";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { checkA11y } from "./helpers/axe";
import {
  expectDesktopLanguageMenuKeyboardReady,
  expectHtmlLang,
  getHeaderMobileMenuButton,
} from "./helpers/navigation";

test.skip(
  SECOND_LOCALE === undefined,
  "单语种站点没有第二语种页面，也不渲染语言切换",
);

// 跳过时不会执行，回退值只为让类型在下面收窄。
const SECOND = SECOND_LOCALE ?? DEFAULT_LOCALE;
const SECOND_PAGES = SECOND_LOCALE ? getSitePageCases(SECOND_LOCALE) : [];
const SECOND_PREFIX = localePrefix(SECOND);
const DEFAULT_NAME = LOCALES_CONFIG.displayNames[DEFAULT_LOCALE];
const SECOND_NAME = LOCALES_CONFIG.displayNames[SECOND];

function languageTriggerName(locale: typeof SECOND): string {
  return getLocaleMessages(locale).accessibility.language.replace(
    "{language}",
    LOCALES_CONFIG.displayNames[locale],
  );
}

// 去掉 as-needed 前缀，得到同一页面在默认语种下的路径。
function toDefaultLocalePath(path: string): string {
  return path.slice(SECOND_PREFIX.length) || "/";
}

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

test.describe("Second locale contract", () => {
  for (const [path, heading] of SECOND_PAGES) {
    test(`${path} renders a complete ${SECOND} page`, async ({ page }) => {
      const response = await page.goto(path, { waitUntil: "domcontentloaded" });

      expect(response?.status(), `${path} should return HTTP 200`).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", SECOND);
      if (heading !== undefined) {
        await expect(
          page.getByRole("heading", { level: 1, name: heading }),
        ).toBeVisible();
      }

      const canonical = page.locator('link[rel="canonical"]');
      await expect(canonical).toHaveCount(1);
      expect(
        new URL((await canonical.getAttribute("href")) ?? "").pathname,
      ).toBe(path);

      const defaultPath = toDefaultLocalePath(path);
      for (const [language, expectedPath] of [
        ...LOCALES_CONFIG.locales.map(
          (locale) => [locale, localizePath(locale, defaultPath)] as const,
        ),
        ["x-default", defaultPath] as const,
      ]) {
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
});

test.describe("Language switcher journey", () => {
  test("keyboard-highlighted language option keeps readable text contrast", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/contact", { waitUntil: "domcontentloaded" });

    const trigger = page.getByRole("button", {
      name: languageTriggerName(DEFAULT_LOCALE),
    });
    // 此用例检查增强菜单的对比度；水合前单次激活由专门回归覆盖。
    await expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await expectDesktopLanguageMenuKeyboardReady(page);
    const second = page.getByRole("menuitem", { name: SECOND_NAME });
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await expect(second).toHaveAttribute("data-highlighted", "");

    await checkA11y(page, '[data-testid="language-dropdown-content"]', {
      axeOptions: { runOnly: ["color-contrast"] },
    });
  });

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
      name: languageTriggerName(DEFAULT_LOCALE),
    });
    await expect(trigger).toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(trigger).toHaveAttribute("aria-expanded", "true");
    await expect(
      page.getByTestId(`language-option-${DEFAULT_LOCALE}`),
    ).toHaveAttribute("aria-current", "true");

    await page.keyboard.press("Escape");
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await expect(trigger).toBeFocused();

    await trigger.click();
    const second = page.getByRole("menuitem", { name: SECOND_NAME });
    await expect(second).toHaveAttribute(
      "href",
      `${SECOND_PREFIX}/contact?source=language-e2e&tag=one&tag=two#inquiry`,
    );
    await page.evaluate(() => Reflect.set(window, "__languageE2E", true));
    await second.click();

    await expectHtmlLang(page, SECOND);
    expectContactUrl(page, `${SECOND_PREFIX}/contact`);
    expect(
      await page.evaluate(() => Reflect.get(window, "__languageE2E")),
    ).toBe(true);
    await expectInquiryDraft(await getEditableInquiryFields(page));
    await expect(
      page.getByRole("button", { name: languageTriggerName(SECOND) }),
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
        `${SECOND_PREFIX}/contact?source=language-e2e&tag=one&tag=two#inquiry`,
        { waitUntil: "domcontentloaded" },
      );

      await fillInquiryDraft(await getEditableInquiryFields(page));
      await page.evaluate(() => window.scrollTo(0, 0));

      const mobileTrigger = getHeaderMobileMenuButton(page);
      await mobileTrigger.click();
      const drawer = page.getByRole("dialog", {
        name: getLocaleMessages(SECOND).accessibility.mobileNavigation,
      });
      await expect(drawer).toBeVisible();
      await expect(page.locator("body")).toHaveCSS("overflow", "hidden");

      await page.getByTestId("mobile-language-trigger").click();
      const defaultLanguage = drawer.getByRole("link", { name: DEFAULT_NAME });
      await expect(defaultLanguage).toHaveAttribute(
        "href",
        "/contact?source=language-e2e&tag=one&tag=two#inquiry",
      );
      await defaultLanguage.click();

      await expectHtmlLang(page, DEFAULT_LOCALE);
      expectContactUrl(page, "/contact");
      await expect(drawer).not.toBeVisible();
      await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
      await expectInquiryDraft(await getEditableInquiryFields(page));
      expect(pageErrors).toEqual([]);
    });
  });
});
