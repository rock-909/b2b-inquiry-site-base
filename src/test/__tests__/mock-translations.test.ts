import { describe, expect, it } from "vitest";
import { getComposedMessages } from "@/lib/i18n/composed-messages";
import { getFlatMessages, lookupMessage } from "@/test/i18n-messages";
import { createMockTranslations } from "@/test/utils";

/**
 * mock 翻译的契约：它必须和生产 next-intl 的取值语义一致，否则拿它写的断言
 * 证明的是测试环境独有的行为。上一版没有这份契约测试，于是"值是空字符串就
 * 回退成 key 名"这个 bug 一路活到审查才被发现。
 */

describe("createMockTranslations 的取值语义", () => {
  it("真实 key 返回真实文案", () => {
    const t = createMockTranslations();
    const real = getComposedMessages("en") as { navigation: { home: string } };

    expect(t("navigation.home")).toBe(real.navigation.home);
    expect(t("navigation.home")).not.toBe("navigation.home");
  });

  // 生产 next-intl 返回存下来的值，空串也照返；不能因为空串是 falsy 就翻成
  // key 名。这里测的是取值语义本身，不依赖消息包当下恰好留空了哪几条——
  // 之前那版断言"包里至少有一个空串"，等社交链接填上真实地址就会无辜变红。
  it("值是空字符串的 key 返回空字符串，不返回 key 名", () => {
    expect(
      lookupMessage(new Map([["social.twitter", ""]]), "social.twitter"),
    ).toBe("");
  });

  // 消息包当下确实留空了几条（社交链接），顺带扫一遍走完整条链路。包里一条
  // 空串都没有时这个循环空转，不构成断言——上面那条才是证明。
  it("消息包里现存的空串条目走完整链路也返回空字符串", () => {
    const t = createMockTranslations();

    for (const [key, value] of getFlatMessages()) {
      if (value === "") expect(t(key)).toBe("");
    }
  });

  it("不存在的 key 回退成 key 本身", () => {
    const t = createMockTranslations();

    expect(t("navigation.thisKeyDoesNotExist")).toBe(
      "navigation.thisKeyDoesNotExist",
    );
  });

  it("覆写真实 key 生效", () => {
    const t = createMockTranslations({ "navigation.home": "改过的" });

    expect(t("navigation.home")).toBe("改过的");
  });

  // 允许覆写不存在的 key，等于让测试自己发明文案——正是这个分支清掉的问题。
  it("覆写不存在的 key 直接报错", () => {
    expect(() =>
      createMockTranslations({ "navigation.notARealKey": "看着挺像" }),
    ).toThrow(/navigation.notARealKey/u);
  });
});
