import { describe, expect, it, vi } from "vitest";
import { generateLocaleStaticParams } from "@/app/[locale]/generate-static-params";

// 这个文件只守一件事：helper 会把 routing 里的每一个 locale 都映射成一条 params。
// 它跟「站点现在出几种语言」解耦，所以这里给一个多语言的 routing。真实语言集合
// 是什么，由 `tests/architecture/tucsenberg-site-contract.test.ts` 手写钉住，首页
// 会为它们预生成页面则由 `page.test.tsx` 钉住。
//
// 单独一个文件，不塞进 `page.test.tsx`：那里全局 setup 已经把 `@/i18n/routing`
// mock 成单语言，要在同一个文件里换掉就得 `vi.doMock` + `vi.resetModules()` +
// 动态 import，而 `vi.doUnmock` 恢复的是真实模块、不是 setup 里的那份 mock，
// 清理语义对不上。Vitest 的 `isolate: true` 让文件级隔离替我们做这件事。
//
// 为什么必须有这条：站点只出 en 时，`routing.locales.slice(0, 1)` 和不截断的
// 结果一模一样，单语言的断言看不出差别。
vi.mock("@/i18n/routing", () => ({
  routing: {
    locales: ["en", "de", "ja"],
    defaultLocale: "en",
  },
}));

describe("generateLocaleStaticParams", () => {
  it("maps every configured locale, not just the first", () => {
    expect(generateLocaleStaticParams()).toEqual([
      { locale: "en" },
      { locale: "de" },
      { locale: "ja" },
    ]);
  });
});
