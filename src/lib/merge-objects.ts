import { hasOwn } from "@/lib/security/object-guards";

/**
 * Deep merge plain objects.
 *
 * - Prefers `source` values when they are defined.
 * - Recursively merges nested plain objects (not arrays).
 */
export function mergeObjects<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>,
): T {
  const result = { ...target };

  // Prevent prototype pollution by dropping known dangerous keys
  const blockedKeys = new Set(["__proto__", "constructor", "prototype"]);

  for (const key in source) {
    if (!hasOwn(source, key)) continue;
    if (blockedKeys.has(key)) continue;
    const sourceValue = source[key];
    if (sourceValue === undefined) continue;
    const targetValue = result[key];

    const isSourcePlain =
      typeof sourceValue === "object" &&
      sourceValue !== null &&
      !Array.isArray(sourceValue);
    const isTargetPlain =
      typeof targetValue === "object" &&
      targetValue !== null &&
      !Array.isArray(targetValue);

    if (isSourcePlain && isTargetPlain) {
      result[key] = mergeObjects(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      ) as T[Extract<keyof T, string>];
      continue;
    }

    result[key] = sourceValue as T[Extract<keyof T, string>];
  }

  return result;
}
