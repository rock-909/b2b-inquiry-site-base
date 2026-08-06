import { type Locale } from "@/i18n/routing-config";
import { loadCompleteMessages } from "@/lib/i18n/load-messages";

type Messages = Record<string, unknown>;

const CLIENT_MESSAGE_NAMESPACES = [
  "accessibility",
  "cookie",
  "errors",
  "navigation",
  "theme",
] as const;

export function getClientMessageNamespaces(): readonly string[] {
  return CLIENT_MESSAGE_NAMESPACES;
}

export function pickMessages(
  messages: Messages,
  namespaces: readonly string[],
): Messages {
  return namespaces.reduce<Messages>((acc, namespace) => {
    const value = messages[namespace];
    if (value !== undefined) {
      acc[namespace] = value;
    }
    return acc;
  }, {});
}

export function pickClientMessages(messages: Messages): Messages {
  return pickMessages(messages, CLIENT_MESSAGE_NAMESPACES);
}

export async function loadClientMessages(locale: Locale): Promise<Messages> {
  const messages = await loadCompleteMessages(locale);
  return pickClientMessages(messages);
}
