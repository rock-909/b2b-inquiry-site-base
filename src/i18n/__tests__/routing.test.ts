import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import {
  DYNAMIC_PATHS_CONFIG,
  PATHS_CONFIG,
} from "@/config/paths/paths-config";
import { PATHNAMES } from "@/config/paths/utils";

/**
 * 这个文件 2026-07-29 从 22 条收到 7 条。删掉的几乎全是同一件事被断言了两到四遍：
 *
 * - `alternateLinks` 未设置：两条
 * - `localeDetection: false`：两条
 * - `locales` 等于 `LOCALES_CONFIG.locales`：三条
 * - `defaultLocale`：三条
 * - `pathnames` 的 key 等于 value：三条
 * - `pathnames` 里有某几条具体路径：四条（主页面、动态路由、法律页各写了一遍，
 *   而路径表本身是从 `PATHNAMES` 派生的）
 *
 * 另有三条是 TypeScript 已经保证的：`Array.isArray(config.locales)`、
 * `typeof config.defaultLocale === "string"`、以及把 `LOCALES_CONFIG.locales`
 * 逐项断言它自己 `toContain`。还有一条 `requiredFields.forEach(toHaveProperty)`
 * ——上面每个字段都已经被断了具体值，再断一次「它存在」是恒真。
 *
 * 留下的是路由配置真正会出错的地方：locale 真相是不是从单一来源取的、路径表是不是
 * 从 `PATHNAMES` 全量派生（漏一条路由会让 next-intl 不认识那个 URL）、
 * shared pathnames 形状、以及两个「必须关着」的开关。
 */

const mockCreateNavigation = vi.fn();
const mockDefineRouting = vi.fn();

vi.mock("next-intl/navigation", () => ({
  createNavigation: mockCreateNavigation,
}));

vi.mock("next-intl/routing", () => ({
  defineRouting: mockDefineRouting,
}));

// 全局 setup（src/test/setup.constants-and-i18n.ts）把 `@/i18n/routing` 整个 mock
// 掉了，那份 mock 还手抄了一整张 pathnames 表。这个文件要测的就是真实模块本身，
// 不解掉的话下面两条断言比的是那份 mock，跟生产代码没有任何连接。
vi.unmock("@/i18n/routing");

describe("i18n Routing Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();

    mockDefineRouting.mockImplementation((config) => config);

    mockCreateNavigation.mockReturnValue({
      Link: vi.fn(),
      redirect: vi.fn(),
      usePathname: vi.fn(),
      useRouter: vi.fn(),
    });
  });

  async function getRoutingDefinition() {
    await import("../routing-config");
    const config = mockDefineRouting.mock.calls[0]?.[0];
    if (!config) {
      throw new Error("defineRouting was not called");
    }
    return config;
  }

  // 名字只承诺「值一致」。要证明它确实读的是 `LOCALES_CONFIG`，靠的是
  // `tests/architecture/locale-source-boundary.test.ts` 那道来源约束，不是这里。
  it("matches the canonical locale configuration", async () => {
    const config = await getRoutingDefinition();

    expect(config.locales).toEqual(LOCALES_CONFIG.locales);
    expect(config.defaultLocale).toBe(LOCALES_CONFIG.defaultLocale);
    expect(config.localePrefix).toBe(LOCALES_CONFIG.localePrefix);
  });

  // 从配置全量派生，而不是钉死一份路径清单：加一个页面忘了登记路由，这条会红；
  // 退役一个页面不该让这里变红。
  //
  // 两条断言方向不同，缺一不可。第一条盯 routing-config 有没有在传给 next-intl 之前
  // 做手脚（过滤、改写、换成手写清单）——正常情况下它就是 `PATHNAMES` 本身，所以
  // 这条比的是引用。第二条从 `PATHS_CONFIG` 和 `DYNAMIC_PATHS_CONFIG` 独立算一遍
  // 期望值，这样即使 `createPathnames()` 自己漏了某一类路径也会红。
  it("hands next-intl every registered pathname", async () => {
    const config = await getRoutingDefinition();

    expect(config.pathnames).toEqual(PATHNAMES);

    const expectedPaths = [
      ...Object.values(PATHS_CONFIG).map((paths) => paths.en),
      ...Object.values(DYNAMIC_PATHS_CONFIG).map((route) => route.pattern),
    ].sort();

    expect(Object.keys(config.pathnames).sort()).toEqual(expectedPaths);
  });

  // Shared pathnames：key 和 value 相同意味着所有语言共用同一个 URL。写成对象形式
  // 就是给每种语言配不同 URL，那和 `localePrefix: "never"` 的单语言站点自相矛盾。
  it("keeps pathnames in shared form", async () => {
    const config = await getRoutingDefinition();

    Object.entries(config.pathnames).forEach(([key, value]) => {
      expect(value).toBe(key);
      expect(key).toMatch(/^\//);
    });
  });

  // 这两个开关必须关着。localeDetection 打开会让浏览器语言把英文买家重定向到一个
  // 不存在的语言路由；alternateLinks 在 `localePrefix: "never"` 下不生成任何东西，
  // hreflang/canonical 归 metadata 层。
  it("keeps locale detection and alternate links off", async () => {
    const config = await getRoutingDefinition();

    expect(config.localeDetection).toBe(false);
    expect(config.alternateLinks).toBeUndefined();
  });

  it("keeps every locale code a two-letter lowercase tag", async () => {
    const config = await getRoutingDefinition();

    config.locales.forEach((locale: string) => {
      expect(locale).toMatch(/^[a-z]{2}$/);
    });
  });

  // 用 `toBe` 比对象身份，不是比值：`routing.ts` 造一个字段相同的新对象也会让值相等
  // 的断言全绿，但那样 app 代码和 middleware 就各拿一份配置了。
  it("re-exports the very object routing-config built", async () => {
    const routingConfigModule = await import("@/i18n/routing-config");
    const routingModule = await import("../routing");

    expect(routingModule.routing).toBe(routingConfigModule.routing);
  });

  // 光断言四个 helper 存在证明不了什么：它们是 mock 返回的。真正会出错的是
  // `createNavigation()` 收到的配置——传错一份，Link 就会生成带 /en 前缀的 URL。
  it("builds the navigation helpers from that same routing object", async () => {
    const routingModule = await import("../routing");

    expect(mockCreateNavigation).toHaveBeenCalledWith(routingModule.routing);
    expect(routingModule.Link).toBeDefined();
    expect(routingModule.redirect).toBeDefined();
    expect(routingModule.usePathname).toBeDefined();
    expect(routingModule.useRouter).toBeDefined();
  });
});
