import { expect, test, type Locator, type Page } from "@playwright/test";
import { checkA11y } from "./helpers/axe";

const routes = [
  { path: "/", viewportWidth: 393, expectsOverflow: false },
  {
    path: "/products/abs-flood-barriers",
    viewportWidth: 393,
    expectsOverflow: true,
  },
  {
    path: "/guides/flood-barrier-materials-guide",
    viewportWidth: 393,
    expectsOverflow: true,
  },
] as const;

test.use({ viewport: { width: 393, height: 851 } });

// 亚像素舍入会让 scrollWidth 比 clientWidth 大 1px，可实际根本滚不动——webkit 上
// 首页那张表就是这样，于是"按了方向键 scrollLeft 还是 0"被判成缺陷。1px 的溢出
// 对键盘用户没有意义，要求一个真实的滚动余量再断言。
const MIN_SCROLLABLE_OVERFLOW_PX = 16;

async function tabToRegion(page: Page, region: Locator): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await page.keyboard.press("Tab");
    if (
      await region.evaluate((element) => document.activeElement === element)
    ) {
      return;
    }
  }

  throw new Error("Scrollable table region was not reachable with Tab");
}

test("table scroll owners are keyboard reachable with visible focus", async ({
  page,
}, testInfo) => {
  // 方向键滚动交给浏览器自己的滚动容器行为，各引擎并不一致：Chrome / Firefox /
  // 桌面 Safari 都滚，Playwright 的触屏模拟档（iPhone 12 / Pixel 5，hasTouch=true）
  // 不滚——那是"触屏设备没有方向键"的模拟结果，不是站点缺陷。可达性和焦点可见
  // 这两条在所有档位都断言；方向键滚动只在有键盘的档位断言。
  const hasKeyboardScrolling = testInfo.project.use.hasTouch !== true;

  for (const route of routes) {
    await page.setViewportSize({ width: route.viewportWidth, height: 851 });
    await page.goto(route.path);
    // 等水合结束再枚举区域。水合会替换 DOM 节点，枚举跑在中间态时有两种表现：
    // 数到的第 n 个在下一步就 "element(s) not found"，或者 locator 指向被换掉的
    // 旧节点、怎么按方向键 scrollLeft 都是 0。并行跑满负载时最容易撞上。
    await page.waitForLoadState("networkidle");
    const regions = page.locator('[data-scrollable-table="true"]');
    const regionCount = await regions.count();

    expect(regionCount).toBeGreaterThan(0);
    let scrollableCount = 0;

    for (let index = 0; index < regionCount; index += 1) {
      const region = regions.nth(index);
      await expect(region).toHaveAttribute("tabindex", "0");
      await tabToRegion(page, region);
      await expect(region).toBeFocused();
      await expect
        .poll(() =>
          region.evaluate((element) => {
            const style = getComputedStyle(element);
            return style.outlineStyle !== "none" || style.boxShadow !== "none";
          }),
        )
        .toBe(true);
      const overflows = await region.evaluate(
        (element, minimum) =>
          element.scrollWidth - element.clientWidth >= minimum,
        MIN_SCROLLABLE_OVERFLOW_PX,
      );

      if (!overflows) continue;

      scrollableCount += 1;
      if (!hasKeyboardScrolling) continue;

      const before = await region.evaluate((element) => element.scrollLeft);
      // 按键发给 region 本身而不是"当前焦点"：整套 e2e 并行跑的时候，懒加载岛
      // 挂载会把焦点抢走，page.keyboard 的方向键就落到别处，表现成随机失败。
      // 重复按只会滚得更远，所以放进 poll 里重试是安全的；方向键真的不起作用时
      // 这条断言照样红。
      //
      // delay 是给 webkit 的：桌面 Safari 的方向键滚动是"按住期间持续给速度"的
      // 动画（KeyboardScrollingAnimator），keydown 和 keyup 之间至少要过一个动画
      // 帧才有位移。Playwright 默认 press 是零间隔的 down+up，动画在第一帧前就被
      // 取消，scrollLeft 恒为 0（实测裸页面也一样，与站点无关；偶尔溜进一帧就
      // 滚 21px，正是之前"时好时坏"的来源）。按住 150ms 模拟真实按键；chromium /
      // firefox 在 keydown 就完成离散滚动，不受影响。
      await expect
        .poll(async () => {
          await region.press("ArrowRight", { delay: 150 });
          return region.evaluate((element) => element.scrollLeft);
        })
        .toBeGreaterThan(before);
    }

    if (route.expectsOverflow) {
      expect(scrollableCount).toBeGreaterThan(0);
    }

    await checkA11y(page, "main#main-content", {
      includedImpacts: ["critical", "serious"],
    });
  }
});
