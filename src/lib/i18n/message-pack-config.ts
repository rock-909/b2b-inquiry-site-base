import messagePacks from "@messages/message-packs.json";

export type MessagePackId = "base" | "b2b-lead";

export const MESSAGE_PACK_IDS = messagePacks as readonly MessagePackId[];
