/**
 * Replace `{placeholder}` tokens in a template with values from a map.
 *
 * Unknown placeholders are left untouched. Values are coerced to strings.
 * Shared by FAQ answer interpolation and SEO string interpolation.
 */
export function interpolate(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = values[key];
    return value !== undefined ? String(value) : match;
  });
}
