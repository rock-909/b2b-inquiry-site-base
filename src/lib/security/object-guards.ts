/**
 * Narrow object ownership guard.
 *
 * The previous broad wrapper set only existed to satisfy scanner shape and was
 * not used by production code. Keep the real boundary primitive used by
 * mergeObjects and let Semgrep focus on actual untrusted-key writes.
 */
export const hasOwn = <T extends object>(
  obj: T,
  key: PropertyKey,
): key is keyof T => {
  return Object.prototype.hasOwnProperty.call(obj, key);
};
