/**
 * Primary UI sans fallback token.
 */
export const systemSans = {
  variable: "",
  className: "",
  style: {
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
} as const;

/**
 * Monospace fallback token
 *
 * Used for spec values, step numbers, standards, proof metrics.
 */
export const jetbrainsMono = {
  variable: "",
  className: "",
  style: {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  },
} as const;

/**
 * Get font class names string for html element.
 */
export function getFontClassNames(): string {
  return "";
}
