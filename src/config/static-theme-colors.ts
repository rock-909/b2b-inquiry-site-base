/**
 * sRGB bridge for src/app/globals.css.
 *
 * Values are a manually reviewed sRGB snapshot derived from the current
 * src/app/globals.css semantic token palette.
 * Use this file for email templates and non-CSS surfaces only.
 * This is not the brand truth source; browser UI must consume CSS tokens.
 */
export const STATIC_THEME_COLORS = {
  primaryText: "#005993",
  success: "#0f7b5f",
  successLight: "#eefbf4",
  text: "#0f1419",
  textLight: "#536471",
  muted: "#536471",
  background: "#ffffff",
  contentBackground: "#f7f8f8",
  headerText: "#ffffff",
  border: "#e1eaef",
} as const;
