import { expect, test } from "@playwright/test";

/**
 * Layout stability contract.
 *
 * The inquiry form renders a short no-JS card until hydration, then swaps in
 * the full form. Without reserved space that swap pushes everything below it
 * down — measured as CLS 0.203 on /request-quote, where the form sits above
 * the fold. This asserts the swap costs no visible movement.
 *
 * Lighthouse fails a route above 0.15; 0.1 is Web Vitals' "good" bound and the
 * budget this contract holds the pages to.
 */

const CLS_BUDGET = 0.1;

// Widths where the form and its sidebar stack, so a growing form pushes the
// sidebar down. At >=1024px they sit side by side and cannot push each other.
// One per reserved-height band in InquiryForm, so a band that drifts out of
// step with the live form cannot hide behind a neighbour that still fits.
const STACKED_VIEWPORTS = [
  { name: "small mobile", width: 360, height: 800 },
  { name: "lighthouse mobile", width: 412, height: 823 },
  { name: "large phone", width: 640, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
] as const;

const INQUIRY_FORM_PAGES = ["/request-quote", "/contact"] as const;

declare global {
  interface Window {
    __clsTotal?: number;
  }
}

async function measureCumulativeLayoutShift(
  page: import("@playwright/test").Page,
  path: string,
): Promise<number> {
  await page.addInitScript(() => {
    window.__clsTotal = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as PerformanceEntry & {
          value: number;
          hadRecentInput: boolean;
        };
        if (!shift.hadRecentInput) {
          window.__clsTotal = (window.__clsTotal ?? 0) + shift.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  });

  await page.goto(`http://localhost:3000${path}`, {
    waitUntil: "networkidle",
  });

  // A page stuck on the static card never swaps, so it never shifts and would
  // score a passing 0. Prove the swap happened before trusting the number.
  await expect(page.locator("#main-content form")).toBeVisible();
  await expect(page.locator("[data-inquiry-form-reserve]")).toHaveCount(0);

  // Give the observer room to record any shift the swap caused.
  await page.waitForTimeout(1200);

  return page.evaluate(() => window.__clsTotal ?? 0);
}

test.describe("Layout stability of the inquiry form swap", () => {
  for (const viewport of STACKED_VIEWPORTS) {
    for (const path of INQUIRY_FORM_PAGES) {
      test(`${path} stays stable at ${viewport.name}`, async ({ page }) => {
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height,
        });

        const cls = await measureCumulativeLayoutShift(page, path);

        expect(
          cls,
          `${path} shifted ${cls.toFixed(3)} at ${viewport.width}px`,
        ).toBeLessThan(CLS_BUDGET);
      });
    }
  }
});
