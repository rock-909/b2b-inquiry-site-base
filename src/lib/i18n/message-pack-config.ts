import catalogMessagePacks from "@messages/message-packs.json";

export type MessagePackId = "base" | "b2b-lead" | "catalog";

export const CATALOG_MESSAGE_PACK_IDS =
  catalogMessagePacks as readonly MessagePackId[];
