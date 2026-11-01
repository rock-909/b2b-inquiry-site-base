import { expect, test, type Locator, type Page } from "@playwright/test";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { getHeaderMobileMenuButton } from "./helpers/navigation";
import { DEFAULT_LOCALE, getLocaleMessages } from "./site-page-cases";

// 动效放慢 10 倍（CDP Animation.setPlaybackRate，仅 Chromium），让“滑到一半”和“是否在动”可以稳定观察；
// 读到的时长仍是 CSS 声明值，不受放慢影响。
const PLAYBACK_RATE = 0.1;
const messages = getLocaleMessages(DEFAULT_LOCALE);

async function slowDownAnimations(page: Page) {
  const session = await page.context().newCDPSession(page);
  await session.send("Animation.enable");
  await session.send("Animation.setPlaybackRate", {
    playbackRate: PLAYBACK_RATE,
  });
}

interface RunningMotion {
  property: string;
  duration: number;
  easing: string;
}

function runningMotion(locator: Locator): Promise<RunningMotion[]> {
  return locator.evaluate((element) =>
    element.getAnimations().map((animation) => {
      const timing = animation.effect?.getTiming();
      return {
        property:
          animation instanceof CSSTransition
            ? animation.transitionProperty
            : (animation as CSSAnimation).animationName,
        duration: Number(timing?.duration ?? 0),
        // 关键帧动画的曲线写在每个关键帧上，效果层恒为 linear。
        easing:
          animation instanceof CSSTransition
            ? String(timing?.easing ?? "")
            : String(
                (animation.effect as KeyframeEffect).getKeyframes()[0]
                  ?.easing ?? "",
              ),
      };
    }),
  );
}

function drawerOf(page: Page) {
  const dialog = page.getByRole("dialog", {
    name: messages.accessibility.mobileNavigation,
  });
  const backdrop = page.locator('[data-slot="sheet-overlay"]');
  return { dialog, backdrop };
}

test.beforeEach(({ browserName }) => {
  test.skip(browserName !== "chromium", "playback-rate control is CDP-only");
});

test.describe("phone menu drawer", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await slowDownAnimations(page);
  });

  test("slides in over 250 ms and out over 200 ms on the drawer curve", async ({
    page,
  }) => {
    const { dialog, backdrop } = drawerOf(page);
    await getHeaderMobileMenuButton(page).tap();
    await expect(dialog).toBeVisible();
    await expect
      .poll(() => runningMotion(dialog))
      .toEqual([
        {
          property: "translate",
          duration: 250,
          easing: "cubic-bezier(0.32, 0.72, 0, 1)",
        },
      ]);
    expect(await runningMotion(backdrop)).toEqual([
      { property: "opacity", duration: 150, easing: "ease" },
    ]);

    await expect.poll(() => runningMotion(dialog)).toEqual([]);
    await page.touchscreen.tap(20, 420);
    await expect
      .poll(() => runningMotion(dialog))
      .toEqual([
        {
          property: "translate",
          duration: 200,
          easing: "cubic-bezier(0.32, 0.72, 0, 1)",
        },
      ]);
    await expect(dialog).toHaveCount(0);
  });

  test("closing mid-slide reverses from where the drawer is, without snapping open", async ({
    page,
  }) => {
    const { dialog } = drawerOf(page);
    await getHeaderMobileMenuButton(page).tap();
    await expect(dialog).toBeVisible();

    // 每帧记录抽屉左边缘相对其停放位置（全开）的偏移；关闭途中偏移只能增加，不能先跳回 0。
    await dialog.evaluate((element) => {
      const samples: { closing: boolean; offset: number }[] = [];
      const restLeft =
        window.innerWidth - element.getBoundingClientRect().width;
      (window as unknown as { drawerSamples: typeof samples }).drawerSamples =
        samples;
      const sample = () => {
        if (!element.isConnected) return;
        samples.push({
          closing: element.hasAttribute("data-ending-style"),
          offset: element.getBoundingClientRect().left - restLeft,
        });
        requestAnimationFrame(sample);
      };
      sample();
    });
    await page.waitForTimeout(400);
    await page.touchscreen.tap(20, 420);
    await expect(dialog).toHaveCount(0);

    const samples = await page.evaluate(
      () =>
        (
          window as unknown as {
            drawerSamples: { closing: boolean; offset: number }[];
          }
        ).drawerSamples,
    );
    const firstClosing = samples.findIndex((entry) => entry.closing);
    expect(firstClosing).toBeGreaterThan(0);
    const offsetAtClose = samples[firstClosing - 1]!.offset;
    // 前提：关闭时抽屉确实还在滑入途中。
    expect(offsetAtClose).toBeGreaterThan(1);
    const closing = samples.slice(firstClosing).map((entry) => entry.offset);
    for (const [index, offset] of closing.entries()) {
      const previous = index === 0 ? offsetAtClose : closing[index - 1]!;
      expect(offset).toBeGreaterThanOrEqual(previous - 0.5);
    }
  });

  test("opens on Enter and closes on Escape instantly", async ({ page }) => {
    const { dialog, backdrop } = drawerOf(page);
    const trigger = getHeaderMobileMenuButton(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    expect(await runningMotion(dialog)).toEqual([]);
    expect(await runningMotion(backdrop)).toEqual([]);

    await page.keyboard.press("Escape");
    // 放慢后的关闭滑动要 2 秒；即时关闭才能在 500ms 内卸载。
    await expect(dialog).toHaveCount(0, { timeout: 500 });
    await expect(trigger).toBeFocused();
  });
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

    test("drops the drawer slide but keeps the backdrop fade", async ({
      page,
    }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      await slowDownAnimations(page);
      const { dialog, backdrop } = drawerOf(page);
      await getHeaderMobileMenuButton(page).tap();
      await expect(dialog).toBeVisible();
      expect(await runningMotion(dialog)).toEqual([]);
      expect(await runningMotion(backdrop)).toEqual([
        { property: "opacity", duration: 150, easing: "ease" },
      ]);
    });
  });

  test("keeps the cookie card fade without the rise", async ({ page }) => {
    // 放慢必须在卡片入场前生效：先开空白页设好，再导航。
    await page.goto("about:blank");
    await slowDownAnimations(page);
    await page.goto("/");
    const card = page.getByRole("region", { name: messages.cookie.title });
    await expect(card).toBeVisible();
    expect(await runningMotion(card)).toEqual([
      {
        property: "enter",
        duration: 200,
        easing: "cubic-bezier(0.23, 1, 0.32, 1)",
      },
    ]);
    const frame = await card.evaluate((element) => {
      const style = getComputedStyle(element);
      return { opacity: Number(style.opacity), transform: style.transform };
    });
    expect(frame.opacity).toBeLessThan(1);
    expect(frame.transform).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/u);
  });

  test("keeps the language menu fade", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/", { waitUntil: "networkidle" });
    await slowDownAnimations(page);
    const trigger = page.getByRole("button", {
      name: messages.accessibility.language.replace(
        "{language}",
        LOCALES_CONFIG.displayNames[DEFAULT_LOCALE],
      ),
    });
    // 首次悬停时菜单岛才加载并以打开状态挂载，不播淡入；第二次悬停才是常态。
    const menu = page.getByTestId("language-dropdown-content");
    await trigger.hover();
    await expect(menu).toBeVisible();
    await page.mouse.move(640, 600);
    await expect(menu).toHaveCount(0);
    await trigger.hover();
    await expect(menu).toBeVisible();
    expect(await runningMotion(menu)).toEqual([
      {
        property: "opacity",
        duration: 150,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      },
    ]);
  });
});
