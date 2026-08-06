import { expect, test } from "@playwright/test";

const frontmatterTokens = [
  "locale:",
  "publishedAt:",
  "updatedAt:",
  "aboutSections:",
  "statLabels:",
  "faq:",
] as const;

test("About renders buyer content without exposing MDX frontmatter", async ({
  page,
}) => {
  const response = await page.goto("/about", { waitUntil: "domcontentloaded" });
  expect(response?.status()).toBe(200);

  const article = page.locator("main#main-content article").first();
  await expect(article).toBeVisible();
  await expect(
    article.getByRole("heading", { level: 2 }).first(),
  ).toBeVisible();

  const articleText = await article.innerText();
  for (const token of frontmatterTokens) {
    expect(articleText).not.toContain(token);
  }
});
