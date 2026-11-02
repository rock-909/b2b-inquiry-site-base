import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { getHeaderMobileMenuButton } from "./helpers/navigation";
import { DEFAULT_LOCALE, getLocaleMessages } from "./site-page-cases";

// 横幅只在构建时配置了 GA 才渲染；E2E 构建用假 ID 打开它。
test.use({ viewport: { width: 390, height: 844 } });

test("the open mobile menu covers the cookie banner", async ({ page }) => {
  await page.goto("/");
  const { cookie, accessibility } = getLocaleMessages(DEFAULT_LOCALE);
  // 模态菜单打开后页面其余部分被 aria-hidden，定位横幅需要 includeHidden。
  const banner = page.getByRole("region", {
    name: cookie.title,
    includeHidden: true,
  });
  await expect(banner).toBeVisible();

  await getHeaderMobileMenuButton(page).click();
  await expect(
    page.getByRole("dialog", { name: accessibility.mobileNavigation }),
  ).toBeVisible();

  // 菜单打开时，横幅中心点处最上层的元素必须是菜单或遮罩，而不是横幅本身。
  await expect
    .poll(() =>
      banner.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return hit !== null && element.contains(hit);
      }),
    )
    .toBe(false);
});

test.describe("on a small phone", () => {
  // 360×640 上首页一屏放不下页脚：Tab 到页脚链接时浏览器要滚动，滚动落点不能停在卡片后面。
  test.use({ viewport: { width: 360, height: 640 } });

  test("on a first visit, every Tab stop up to the footer links stays clear of the cookie card", async ({
    page,
  }) => {
    await page.goto("/");
    const { cookie } = getLocaleMessages(DEFAULT_LOCALE);
    await expect(
      page.getByRole("region", { name: cookie.title }),
    ).toBeVisible();

    // 每按一次 Tab：焦点元素中心点处最上层的元素必须是它自己（没被卡片或页头盖住）。
    const stops: { name: string; inFooter: boolean; visible: boolean }[] = [];
    for (let press = 0; press < 60; press += 1) {
      await page.keyboard.press("Tab");
      const stop = await page.evaluate(() => {
        const element = document.activeElement;
        // 焦点进入同意卡片，说明页面里的停点已经走完。
        if (!(element instanceof HTMLElement)) return null;
        if (element.closest('[role="region"]')) return null;
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return {
          name:
            element.getAttribute("aria-label") ??
            element.textContent?.trim() ??
            element.tagName,
          inFooter: element.closest("footer") !== null,
          visible: hit !== null && element.contains(hit),
        };
      });
      if (stop === null) break;
      stops.push(stop);
    }

    expect(stops.filter((stop) => stop.inFooter).length).toBeGreaterThan(0);
    expect(
      stops.filter((stop) => !stop.visible).map((stop) => stop.name),
    ).toEqual([]);
  });
});

test("withdrawing consent in cookie settings removes GA cookies", async ({
  page,
  context,
  baseURL,
}) => {
  // gtag 不得真正联网：所有 Google 请求就地中止，GA cookie 由用例自己种下。
  await page.route(/googletagmanager\.com|google-analytics\.com/u, (route) =>
    route.abort(),
  );
  // 裸 localhost 存不了 Domain cookie；*.localhost 同样解析到回环地址，借子域名覆盖 GA 的两种写法。
  const site = new URL(baseURL!);
  if (site.hostname === "localhost") site.hostname = "www.site.localhost";
  const parentDomain = site.hostname.replace(/^[^.]+\./u, ".");
  await page.goto(site.href);
  const { cookie } = getLocaleMessages(DEFAULT_LOCALE);
  await page.getByRole("button", { name: cookie.acceptAll }).click();

  // GA 默认写在可写的最高一级域名上（Domain=.example.com），也可能是仅主机形式；两种都种。
  await context.addCookies(
    ["_ga", "_ga_E2ETEST000"].flatMap((name) => [
      { name, value: "GA1.1.1.1", url: site.origin },
      { name, value: "GA1.1.1.1", domain: parentDomain, path: "/" },
    ]),
  );
  const gaCookies = async () =>
    (await context.cookies())
      .filter(({ name }) => name === "_ga" || name.startsWith("_ga_"))
      .map(({ name, domain }) => `${name}@${domain}`);
  expect(await gaCookies()).toHaveLength(4);

  await page.getByRole("button", { name: cookie.settings }).click();
  await expect(page.getByRole("region", { name: cookie.title })).toBeVisible();
  await expect.poll(gaCookies).toEqual([]);
});

test.describe("on a laptop-sized window", () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test("the open cookie card leaves the contact submit button clickable", async ({
    page,
  }) => {
    await page.goto("/contact");
    const { cookie } = getLocaleMessages(DEFAULT_LOCALE);
    const banner = page.getByRole("region", { name: cookie.title });
    await banner.getByRole("button", { name: cookie.customize }).click();
    await expect(
      banner.getByRole("checkbox", { name: cookie.analytics }),
    ).toBeVisible();

    // 不滚动、不关闭卡片：提交按钮中心点处最上层的元素必须是按钮本身。
    const submit = page.locator("#inquiry button[type=submit]");
    await expect
      .poll(() =>
        submit.evaluate((element) => {
          const rect = element.getBoundingClientRect();
          const hit = document.elementFromPoint(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
          );
          return hit !== null && element.contains(hit);
        }),
      )
      .toBe(true);
  });
});

// 首页较短，页脚贴在窗口底部。同意卡片若在客户端才出现、再把高度加到页脚上，
// 页脚会整体上移（曾测得手机 CLS 0.08、桌面 0.045）。首访和回访都不能有这次位移。
const FOOTER_SHIFT_VIEWPORTS = [
  { name: "phone", viewport: { width: 390, height: 844 } },
  { name: "desktop", viewport: { width: 1350, height: 940 } },
] as const;

interface LayoutShift {
  value: number;
  sources: string[];
}

type ShiftWindow = Window & { layoutShifts?: LayoutShift[] };

// 页面脚本运行前装好观察器，把每次 layout-shift 记到 window 上（每次加载重新开始）。
function recordLayoutShifts() {
  const shifts: LayoutShift[] = [];
  (window as ShiftWindow).layoutShifts = shifts;
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      value: number;
      sources?: { node?: Node | null }[];
    })[]) {
      shifts.push({
        value: entry.value,
        sources: (entry.sources ?? []).map(
          (source) => source.node?.nodeName ?? "unknown",
        ),
      });
    }
  }).observe({ type: "layout-shift", buffered: true });
}

// 等两帧和一个任务，让最近一次布局的记录送达观察器，再取出全部记录。
function readLayoutShifts(): Promise<LayoutShift[]> {
  return new Promise((resolve) => {
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        setTimeout(() => resolve((window as ShiftWindow).layoutShifts ?? [])),
      ),
    );
  });
}

for (const { name, viewport } of FOOTER_SHIFT_VIEWPORTS) {
  test.describe(`home page layout on ${name}`, () => {
    test.use({ viewport });

    test("nothing shifts on a first visit with the cookie card or on a returning visit", async ({
      page,
    }) => {
      const messages = getLocaleMessages(DEFAULT_LOCALE);
      const banner = page.getByRole("region", { name: messages.cookie.title });
      const themeButton = page.getByRole("button", {
        name: messages.theme.switchToSystem,
      });
      const readShifts = () => page.evaluate(readLayoutShifts);
      const totalShift = (shifts: LayoutShift[]) =>
        shifts.reduce((sum, shift) => sum + shift.value, 0);

      await page.addInitScript(recordLayoutShifts);
      await page.goto("/");
      await expect(banner).toBeVisible();
      // 等客户端接管（主题按钮在 hydration 后启用），卡片此时已按存储状态定下来。
      await expect(themeButton).toBeEnabled();
      const firstVisit = await readShifts();
      expect(totalShift(firstVisit), JSON.stringify(firstVisit)).toBeLessThan(
        0.01,
      );

      await banner
        .getByRole("button", { name: messages.cookie.rejectAll })
        .click();
      await page.reload();
      await expect(themeButton).toBeEnabled();
      await expect(banner).toBeHidden();
      const returningVisit = await readShifts();
      expect(
        totalShift(returningVisit),
        JSON.stringify(returningVisit),
      ).toBeLessThan(0.01);
    });

    // 同意版本升级后，回访者存着旧版本记录：客户端读到后会丢弃它并重新显示卡片，
    // 预绘制脚本必须同样把它当作无效记录，让卡片从首帧占位。
    test("nothing shifts on a returning visit with an older consent version stored", async ({
      page,
    }) => {
      const messages = getLocaleMessages(DEFAULT_LOCALE);
      const banner = page.getByRole("region", { name: messages.cookie.title });
      const themeButton = page.getByRole("button", {
        name: messages.theme.switchToSystem,
      });

      await page.addInitScript(() => {
        // 版本 2 的记录还没有 advertising 字段。
        window.localStorage.setItem(
          "cookie-consent",
          JSON.stringify({
            consent: { necessary: true, analytics: true },
            updatedAt: "2026-01-01T00:00:00.000Z",
            version: 2,
          }),
        );
      });
      await page.addInitScript(recordLayoutShifts);
      await page.goto("/");
      await expect(themeButton).toBeEnabled();
      await expect(banner).toBeVisible();
      // 控制器读过存储并删掉了旧记录，卡片的去留此时已定。
      await expect
        .poll(() =>
          page.evaluate(() => window.localStorage.getItem("cookie-consent")),
        )
        .toBeNull();
      const shifts = await page.evaluate(readLayoutShifts);
      const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
      expect(total, JSON.stringify(shifts)).toBeLessThan(0.01);
    });
  });
}

// Workers 流式输出 HTML，浏览器可能在页脚已到、同意卡片还没到时先绘制一帧。
// 这里用本地代理把首页 HTML 在 </footer> 之后切成两块、间隔发送，复现那一帧。
test.describe("home page streamed in two chunks split after the footer", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  let proxy: Server;
  let proxyUrl = "";

  test.beforeAll(async () => {
    const upstream = String(test.info().project.use.baseURL);
    proxy = createServer(async (request, response) => {
      const upstreamResponse = await fetch(
        new URL(request.url ?? "/", upstream),
        {
          headers: { accept: request.headers.accept ?? "*/*" },
          redirect: "manual",
        },
      );
      const body = Buffer.from(await upstreamResponse.arrayBuffer());
      const headers: Record<string, string> = {};
      upstreamResponse.headers.forEach((value, key) => {
        if (
          !["content-length", "content-encoding", "transfer-encoding"].includes(
            key,
          )
        ) {
          headers[key] = value;
        }
      });
      response.writeHead(upstreamResponse.status, headers);
      const html = body.toString("utf8");
      const split = html.indexOf("</footer>");
      if (request.url !== "/" || split === -1) {
        response.end(body);
        return;
      }
      const cut = split + "</footer>".length;
      response.write(html.slice(0, cut));
      await new Promise((resolve) => setTimeout(resolve, 500));
      response.end(html.slice(cut));
    });
    await new Promise<void>((resolve) => proxy.listen(0, "localhost", resolve));
    proxyUrl = `http://localhost:${(proxy.address() as AddressInfo).port}`;
  });

  test.afterAll(async () => {
    await new Promise((resolve) => proxy.close(resolve));
  });

  test("the footer does not shift when the cookie card arrives in the second chunk", async ({
    page,
  }) => {
    const messages = getLocaleMessages(DEFAULT_LOCALE);
    await page.addInitScript(recordLayoutShifts);
    await page.goto(`${proxyUrl}/`);
    await expect(
      page.getByRole("region", { name: messages.cookie.title }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: messages.theme.switchToSystem }),
    ).toBeEnabled();
    const shifts = await page.evaluate(readLayoutShifts);
    const total = shifts.reduce((sum, shift) => sum + shift.value, 0);
    expect(total, JSON.stringify(shifts)).toBeLessThan(0.01);
  });
});
