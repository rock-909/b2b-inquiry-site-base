/**
 * 测试用翻译的唯一来源：生产运行时那份合成消息。
 *
 * 这里存在的理由是别处不许再手写一份。仓库里同时躺过两份手抄消息表——
 * `src/test/constants/mock-messages.ts`（172 个叶子键里 153 个真实消息包
 * 中根本不存在）和 `setup.constants-and-i18n.ts` 里的七条导航文案（其中
 * `navigation.services`、`navigation.contact` 同样不存在）。用它们写的断言
 * 证明的是虚构文案，改动真实文案不会让任何测试变红。
 */

import { getSourceMessages } from "@/lib/i18n/load-messages";
import type { Locale } from "@/types/content.types";

function flatten(
  source: Record<string, unknown>,
  prefix = "",
): Map<string, string> {
  const flattened = new Map<string, string>();

  for (const [key, value] of Object.entries(source)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (typeof value === "string") {
      flattened.set(fullKey, value);
    } else if (typeof value === "object" && value !== null) {
      for (const [nestedKey, nestedValue] of flatten(
        value as Record<string, unknown>,
        fullKey,
      )) {
        flattened.set(nestedKey, nestedValue);
      }
    }
  }

  return flattened;
}

/** 真实消息包合成后的全部叶子，扁平成点号 key。 */
export function getFlatMessages(locale: Locale = "en"): Map<string, string> {
  return flatten(getSourceMessages(locale) as Record<string, unknown>);
}

/**
 * next-intl 的取值语义：key 存在就返回它的值，哪怕值是空字符串；用真假判断
 * 会把留空的社交链接翻成 key 名。key 不存在时真实 next-intl 报
 * MISSING_MESSAGE，这里直接抛错，免得断言 key 名的测试静默通过。
 * 传了 values 就替换简单的 `{name}` 占位符（不支持 ICU 复数/select）。
 */
export function lookupMessage(
  messages: Map<string, string>,
  key: string,
  values?: Record<string, string | number>,
): string {
  const message = messages.get(key);
  if (message === undefined) throw new Error(`MISSING_MESSAGE: ${key}`);
  if (!values) return message;

  return message.replace(/\{(\w+)\}/gu, (placeholder, name: string) =>
    name in values ? String(values[name]) : placeholder,
  );
}
