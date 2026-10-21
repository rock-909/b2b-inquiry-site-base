import { expect, test } from "@playwright/test";
import { localePrefix, SECOND_LOCALE } from "./site-page-cases";

declare global {
  interface Window {
    __clsTotal?: number;
  }
}

const CONTACT_PATHS = [
  "/contact",
  ...(SECOND_LOCALE ? [`${localePrefix(SECOND_LOCALE)}/contact`] : []),
];

// 尺寸与官方一致：容器 ≥300px 用 flexible（通栏×65），否则 compact（150×140）；
// 单元测试另守真实封装的 size 选项，CI 不请求外部服务。
for (const path of CONTACT_PATHS) {
  for (const initialWidth of [320, 390, 640, 768]) {
    test(`bot-check footprint fits ${path} from ${initialWidth}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: initialWidth, height: 844 });
      await page.addInitScript(() => {
        window.__clsTotal = 0;
        if (PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              const shift = entry as PerformanceEntry & {
                value: number;
                hadRecentInput: boolean;
              };
              if (!shift.hadRecentInput)
                window.__clsTotal = (window.__clsTotal ?? 0) + shift.value;
            }
          }).observe({ type: "layout-shift", buffered: true });
        }
        const sizeMock = () => {
          for (const element of document.querySelectorAll<HTMLElement>(
            '[data-testid="turnstile-mock"]:not([data-footprint])',
          )) {
            const fits = (element.parentElement?.clientWidth ?? 0) >= 300;
            element.dataset.footprint = fits ? "flexible" : "compact";
            element.style.width = fits ? "100%" : "150px";
            element.style.height = fits ? "65px" : "140px";
          }
        };
        new MutationObserver(sizeMock).observe(document, {
          childList: true,
          subtree: true,
        });
      });
      // 暂停脚本以测量服务端占位，释放后验证真实水合或延迟挂载。
      let releaseScripts!: () => void;
      const scriptsReady = new Promise<void>((resolve) => {
        releaseScripts = resolve;
      });
      await page.route("**/*", async (route) => {
        const url = new URL(route.request().url());
        if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
          await route.abort();
          return;
        }
        if (route.request().resourceType() === "script") await scriptsReady;
        await route.continue();
      });
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const reservation = await page
        .locator("[data-inquiry-form-reserve], [data-inquiry-form-deferred]")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            kind: element.hasAttribute("data-inquiry-form-deferred")
              ? "deferred"
              : "reserve",
            height: element.getBoundingClientRect().height,
            minHeight: getComputedStyle(element).minHeight,
          })),
        );
      expect(reservation).toHaveLength(1);
      releaseScripts();
      await page.waitForLoadState("load");
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const form = page.getByTestId("inquiry-form");
      await expect(form.locator('[name="fullName"]')).toBeEditable();
      const widget = page.getByTestId("turnstile-mock");
      await expect(widget).toHaveAttribute(
        "data-footprint",
        /flexible|compact/,
      );
      await expect(page.locator("[data-inquiry-form-reserve]")).toHaveCount(0);
      // 等两帧渲染完成，让 layout-shift 观察者记录替换造成的位移。
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      const heights = await form.evaluate((element) => ({
        form: element.getBoundingClientRect().height,
        card: element.parentElement!.getBoundingClientRect().height,
        deferred: document
          .querySelector("[data-inquiry-form-deferred]")
          ?.getBoundingClientRect().height,
      }));
      test.info().annotations.push({
        type: "initial-layout",
        description: JSON.stringify({ initialWidth, reservation, heights }),
      });
      if (
        await page.evaluate(() =>
          PerformanceObserver.supportedEntryTypes.includes("layout-shift"),
        )
      ) {
        const cls = await page.evaluate(() => window.__clsTotal ?? 0);
        test.info().annotations.push({ type: "CLS", description: String(cls) });
        expect(cls).toBeLessThan(0.1);
      }
      const field = form.locator('[name="fullName"]');
      await field.fill("Layout fixture");
      await field.focus();
      for (const width of initialWidth === 320
        ? [320, 375, 390, 844, 1280, 320]
        : [initialWidth]) {
        await page.setViewportSize({ width, height: 844 });
        await expect(field).toBeFocused();
        await expect(form.locator('button[type="submit"]')).toBeEnabled();
        const box = await widget.boundingBox();
        const formBox = await form.boundingBox();
        expect(box).not.toBeNull();
        expect(formBox).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(formBox!.x);
        expect(box!.x + box!.width).toBeLessThanOrEqual(
          formBox!.x + formBox!.width,
        );
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBe(width);
      }
    });
  }
}
