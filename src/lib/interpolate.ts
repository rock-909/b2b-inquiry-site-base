/**
 * Replace `{placeholder}` tokens in a template with values from a map.
 *
 * Unknown placeholders are left untouched. Values are coerced to strings.
 * Shared by message, FAQ and SEO string interpolation, which all pass the
 * site placeholder table from `getSiteMessageValues()`.
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
