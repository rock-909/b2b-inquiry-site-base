import type { Locale } from "@/i18n/routing-config";
import { mergeObjects } from "@/lib/merge-objects";
import {
  CATALOG_MESSAGE_PACK_IDS,
  type MessagePackId,
} from "@/lib/i18n/message-pack-config";

import enBaseMessages from "@messages/base/en/messages.json";
import enB2bLeadMessages from "@messages/profiles/b2b-lead/en/messages.json";
import enCatalogMessages from "@messages/profiles/catalog/en/messages.json";

type ComposedMessages = Record<string, unknown>;

const STATIC_PACKS: Record<Locale, Record<MessagePackId, ComposedMessages>> = {
  en: {
    base: enBaseMessages,
    "b2b-lead": enB2bLeadMessages,
    catalog: enCatalogMessages,
  },
};

/**
 * Compose the fixed catalog message graph for a locale.
 * Ownership order: base -> b2b-lead -> catalog.
 */
export function getComposedMessages(locale: Locale): ComposedMessages {
  return CATALOG_MESSAGE_PACK_IDS.reduce<ComposedMessages>(
    (acc, packId) =>
      mergeObjects(acc, STATIC_PACKS[locale][packId]) as ComposedMessages,
    {},
  );
}
