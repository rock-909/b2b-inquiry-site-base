/**
 * Split a comma-separated env value into normalized entries:
 * trimmed, lowercased, empty segments dropped.
 */
export function parseCommaSeparatedValues(
  value: string | null | undefined,
): string[] {
  if (!value) return [];

  return value.split(",").flatMap((entry) => {
    const normalized = entry.trim().toLowerCase();
    return normalized ? [normalized] : [];
  });
}
