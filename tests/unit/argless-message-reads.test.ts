import { createTranslator, type IntlError, type Messages } from "next-intl";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing-config";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";

type JsonObject = Record<string, unknown>;

// 邮件文案与 llms.txt 描述调用 t(key) 时不传参数，这些消息必须是纯文本。
const ARGLESS_NAMESPACES = ["emailTemplates", "home.metadata"] as const;

function leafKeys(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) return [prefix];
  return Object.entries(value as JsonObject).flatMap(([key, nested]) =>
    leafKeys(nested, prefix ? `${prefix}.${key}` : key),
  );
}

function getNamespace(messages: JsonObject, namespace: string): unknown {
  return namespace
    .split(".")
    .reduce<unknown>(
      (current, key) => (current as JsonObject | undefined)?.[key],
      messages,
    );
}

describe("messages read without arguments", () => {
  for (const locale of routing.locales) {
    for (const namespace of ARGLESS_NAMESPACES) {
      it(`formats every ${namespace} message in ${locale} without errors`, () => {
        const messages = loadCompleteMessages(locale);
        const errors: string[] = [];
        const t = createTranslator({
          locale,
          messages: messages as Messages,
          namespace: namespace as never,
          onError: (error: IntlError) => errors.push(error.message),
        }) as unknown as (key: string) => string;

        const keys = leafKeys(getNamespace(messages, namespace));
        expect(keys.length).toBeGreaterThan(0);
        for (const key of keys) {
          expect(t(key), `${locale}:${namespace}.${key}`).not.toBe(
            `${namespace}.${key}`,
          );
        }
        expect(errors).toEqual([]);
      });
    }
  }
});
