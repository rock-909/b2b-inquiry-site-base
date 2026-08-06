/**
 * next-intl 的翻译 mock。
 *
 * 翻译走 `@/test/i18n-messages`，那里读的是生产运行时用的同一份合成消息。
 * 要覆写就传扁平 key：`createMockTranslations({ "navigation.home": "X" })`。
 * 覆写不存在的 key 会直接抛错——覆写是用来改真实文案的，不是用来发明文案的。
 */

import { vi } from "vitest";
import { getFlatMessages, lookupMessage } from "@/test/i18n-messages";

/**
 * 创建 mock 翻译函数。默认消息＝真实合成消息包，不是手写清单。
 *
 * @param translations - 可选的扁平 key 覆写
 * @returns Mock 翻译函数
 *
 * @example
 * ```typescript
 * const t = createMockTranslations();
 * const t = createMockTranslations({ "navigation.home": "Custom Home" });
 * ```
 */
export const createMockTranslations = (
  translations?: Record<string, string>,
) => {
  const messages = getFlatMessages();

  // 覆写只能覆写真实存在的 key，避免测试自己发明生产中不存在的文案。
  const unknownKeys = Object.keys(translations ?? {}).filter(
    (key) => !messages.has(key),
  );
  if (unknownKeys.length > 0) {
    throw new Error(
      `createMockTranslations: 这些 key 在真实消息包里不存在，覆写它们证明不了任何事：${unknownKeys.join(", ")}`,
    );
  }

  for (const [key, value] of Object.entries(translations ?? {})) {
    messages.set(key, value);
  }

  return vi.fn((key: string) => lookupMessage(messages, key));
};

export const createMockUseTranslations = (
  translations?: Record<string, string>,
) => {
  const translate = createMockTranslations(translations);

  return vi.fn((namespace?: string) =>
    vi.fn((key: string) => translate(namespace ? `${namespace}.${key}` : key)),
  );
};
