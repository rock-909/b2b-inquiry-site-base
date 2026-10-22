/**
 * sRGB bridge for src/app/theme.css.
 *
 * Values are an sRGB snapshot of light-theme steps in src/app/theme.css:
 * text neutral-12; textLight and muted neutral-11; background and headerText
 * neutral-1; contentBackground neutral-2. success is an email-only status color.
 * Use this file for email templates and non-CSS surfaces only.
 * This is not the brand truth source; browser UI must consume CSS tokens.
 */
export const STATIC_THEME_COLORS = {
  success: "#0f7b5f",
  text: "#0f1419",
  textLight: "#4f555b",
  muted: "#4f555b",
  background: "#ffffff",
  contentBackground: "#f8f8f8",
  headerText: "#ffffff",
} as const;
