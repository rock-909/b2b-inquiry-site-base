import { expect, test } from "@playwright/test";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import {
  DEFAULT_LOCALE,
  getLocaleMessages,
  localizePath,
} from "./site-page-cases";

const LOCALE_CASES = LOCALES_CONFIG.locales.map((locale) => {
  const { title, goHome } = getLocaleMessages(locale).errors.notFound;
  return {
    locale,
    title,
    homeLabel: goHome,
    homePath: localizePath(locale, "/"),
  };
});

test.describe("404 recovery without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  for (const { locale, title, homeLabel, homePath } of LOCALE_CASES) {
    // 默认语种既可无前缀访问，也可显式带前缀访问。
    const prefixes =
      locale === DEFAULT_LOCALE ? ["", `/${locale}`] : [`/${locale}`];
    for (const prefix of prefixes) {
      for (const path of [
        "/this-page-does-not-exist",
        "/products/not-real",
        "/random.txt",
        "/images/retired-asset.jpg",
        "/does-not-exist.svg",
        "/__e2e-missing-section/offering",
        "/__not-found-placeholder",
      ]) {
        test(`${prefix}${path} serves a localized recovery document`, async ({
          page,
        }) => {
          const response = await page.goto(`${prefix}${path}`, {
            waitUntil: "domcontentloaded",
          });
          expect(response?.status()).toBe(404);
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          const main = page.getByRole("main");
          await expect(main.locator("p").first()).toBeVisible();
          await expect(
            main.getByRole("heading", { level: 1, name: title, exact: true }),
          ).toBeVisible();
          const home = main.getByRole("link", {
            name: homeLabel,
            exact: true,
          });
          await expect(home).toBeVisible();
          await expect(home).toHaveAttribute("href", homePath);
          // 404 不应继承页面的分享图片元数据。
          await expect(page.locator('meta[property="og:image"]')).toHaveCount(
            0,
          );
          await expect(page.locator('meta[name="twitter:image"]')).toHaveCount(
            0,
          );
        });
      }
    }
  }
});

for (const { locale, title, homeLabel, homePath } of LOCALE_CASES) {
  const path = localizePath(locale, "/random.txt");
  test(`${path} recovers through client navigation`, async ({
    page,
    baseURL,
  }) => {
    await page.goto(path);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { name: title })).toBeVisible();
    await main.getByRole("link", { name: homeLabel }).click();
    await expect(page).toHaveURL(new URL(homePath, baseURL).href);
    await expect(
      page.getByRole("main").getByRole("heading", { level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole("main").getByRole("heading", { name: title }),
    ).toHaveCount(0);
  });
}

test("real resources retain their response bodies and MIME types", async ({
  page,
  request,
}) => {
  for (const [path, mime, marker] of [
    ["/.well-known/security.txt", "text/plain", "Contact:"],
    ["/robots.txt", "text/plain", "User-Agent:"],
    ["/sitemap.xml", "application/xml", "<urlset"],
    ["/icon.svg", "image/svg+xml", "<svg"],
    ["/api/health", "application/json", "status"],
  ]) {
    const response = await request.get(path!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(mime);
    expect(await response.text()).toContain(marker);
  }
  const image = await request.get("/opengraph-image.png");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  expect((await image.body()).subarray(0, 8).toString("hex")).toBe(
    "89504e470d0a1a0a",
  );
  const policy = await request.get("/security-policy.txt");
  expect(policy.status()).toBe(404);
  expect(await policy.text()).toBe("");

  await page.goto("/");
  for (const [selector, attribute, mime] of [
    ['link[rel="stylesheet"]', "href", "text/css"],
    ['script[src^="/_next/"]', "src", "javascript"],
  ]) {
    const path = await page.locator(selector!).first().getAttribute(attribute!);
    expect(path).toBeTruthy();
    const response = await request.get(path!);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain(mime);
    expect((await response.body()).length).toBeGreaterThan(0);
    expect(await response.text()).not.toContain("<!DOCTYPE html>");
  }
});
