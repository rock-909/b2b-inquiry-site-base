import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CATALOG_MESSAGE_PACK_IDS,
  type MessagePackId,
} from "@/lib/i18n/message-pack-config";
import { getComposedMessages } from "@/lib/i18n/composed-messages";
import { mergeObjects } from "@/lib/merge-objects";
import {
  getClientMessageNamespaces,
  pickClientMessages,
} from "@/lib/i18n/client-messages";

const LOCALES = ["en"] as const;
const REQUIRED_PACK_FILES = [
  ...CATALOG_MESSAGE_PACK_IDS.flatMap((packId) =>
    LOCALES.map((locale) => getPackPath(packId, locale)),
  ),
];

function packFileExists(relativePath: string): boolean {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test checks fixed pack paths from REQUIRED_PACK_FILES
  return fs.existsSync(relativePath);
}

function getPackPath(packId: MessagePackId, locale: (typeof LOCALES)[number]) {
  const packRoot =
    packId === "base" ? "messages/base" : `messages/profiles/${packId}`;

  return `${packRoot}/${locale}/messages.json`;
}

function readJson(filePath: string): Record<string, unknown> {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- test reads fixed message pack paths from config
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
    string,
    unknown
  >;
}

function composeCatalogMessages(locale: (typeof LOCALES)[number]) {
  return CATALOG_MESSAGE_PACK_IDS.reduce<Record<string, unknown>>(
    (messages, packId) =>
      mergeObjects(messages, readJson(getPackPath(packId, locale))),
    {},
  );
}

describe("physical message packs", () => {
  it("keeps every required pack file present", () => {
    for (const filePath of REQUIRED_PACK_FILES) {
      expect(packFileExists(filePath), filePath).toBe(true);
    }
  });

  it("keeps runtime and static helpers on physical packs", () => {
    const loader = fs.readFileSync("src/lib/i18n/load-messages.ts", "utf8");
    const composed = fs.readFileSync(
      "src/lib/i18n/composed-messages.ts",
      "utf8",
    );
    const nextIntlTypes = fs.readFileSync("src/types/next-intl.d.ts", "utf8");
    const storybook = fs.readFileSync(
      "src/lib/i18n/storybook-messages.ts",
      "utf8",
    );

    expect(loader).toContain("@/lib/i18n/composed-messages");
    expect(composed).toContain("@messages/base/en/messages.json");
    expect(composed).toContain("@messages/profiles/b2b-lead/en/messages.json");
    expect(composed).toContain("@messages/profiles/catalog/en/messages.json");
    expect(nextIntlTypes).toContain("@messages/base/en/messages.json");
    expect(storybook).toContain("@/lib/i18n/composed-messages");
  });

  it("keeps the shared composition helper aligned with pack merge order", () => {
    for (const locale of LOCALES) {
      expect(getComposedMessages(locale)).toEqual(
        composeCatalogMessages(locale),
      );
    }
  });

  it("keeps client payload limited to the namespace pick", () => {
    const composed = getComposedMessages("en");
    const clientMessages = pickClientMessages(composed);
    const namespaces = [...getClientMessageNamespaces()].sort();

    expect(Object.keys(clientMessages).sort()).toEqual(namespaces);
    expect(Object.keys(clientMessages).length).toBeLessThan(
      Object.keys(composed).length,
    );
  });
});
