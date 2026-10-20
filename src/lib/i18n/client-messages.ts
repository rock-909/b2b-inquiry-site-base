import type { Locale } from "@/i18n/routing-config";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";

type Messages = Record<string, unknown>;

const CLIENT_MESSAGE_NAMESPACES = [
  "accessibility",
  "cookie",
  "errors",
  "navigation",
  "theme",
] as const;

function pickClientMessages(messages: Messages): Messages {
  return CLIENT_MESSAGE_NAMESPACES.reduce<Messages>((acc, namespace) => {
    const value = messages[namespace];
    if (value !== undefined) {
      acc[namespace] = value;
    }
    return acc;
  }, {});
}

export async function loadClientMessages(locale: Locale): Promise<Messages> {
  const messages = await loadCompleteMessages(locale);
  return pickClientMessages(messages);
}
