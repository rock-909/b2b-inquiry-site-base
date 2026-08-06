export type MessageRecord = Record<string, unknown>;

function formatMessagePath(path: readonly string[]): string {
  return path.join(".");
}

function readPathValue(messages: MessageRecord, path: readonly string[]) {
  let current: unknown = messages;

  for (const segment of path) {
    if (
      typeof current !== "object" ||
      current === null ||
      !(segment in current)
    ) {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function readRequiredMessagePath(
  messages: MessageRecord,
  path: readonly string[],
): string {
  const value = readPathValue(messages, path);

  if (typeof value !== "string") {
    throw new Error(`Missing required message: ${formatMessagePath(path)}`);
  }

  return value;
}
