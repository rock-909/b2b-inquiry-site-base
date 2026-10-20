/**
 * sRGB bridge for src/app/theme.css.
 *
 * Values are an sRGB snapshot of light-theme steps in src/app/theme.css:
 * primaryText brand-11; text neutral-12; textLight and muted neutral-11;
 * background and headerText neutral-1; contentBackground neutral-2; border
 * neutral-6. success and successLight are email-only status colors.
 * Use this file for email templates and non-CSS surfaces only.
 * This is not the brand truth source; browser UI must consume CSS tokens.
 */
export const STATIC_THEME_COLORS = {
  primaryText: "#005993",
  success: "#0f7b5f",
  successLight: "#eefbf4",
  text: "#0f1419",
  textLight: "#4f555b",
  muted: "#4f555b",
  background: "#ffffff",
  contentBackground: "#f8f8f8",
  headerText: "#ffffff",
  border: "#e4e4e4",
} as const;
