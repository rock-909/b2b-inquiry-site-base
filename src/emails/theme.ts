/**
 * Email theme constants for consistent styling across all email templates.
 * Uses inline styles for maximum email client compatibility.
 */

import { STATIC_THEME_COLORS } from "@/config/static-theme-colors";

export const COLORS = {
  primary: STATIC_THEME_COLORS.primaryText,
  success: STATIC_THEME_COLORS.success,
  successLight: STATIC_THEME_COLORS.successLight,
  text: STATIC_THEME_COLORS.text,
  textLight: STATIC_THEME_COLORS.textLight,
  muted: STATIC_THEME_COLORS.muted,
  background: STATIC_THEME_COLORS.background,
  contentBackground: STATIC_THEME_COLORS.contentBackground,
  headerText: STATIC_THEME_COLORS.headerText,
  border: STATIC_THEME_COLORS.border,
} as const;

export const SPACING = {
  xs: "6px",
  sm: "10px",
  md: "15px",
  lg: "20px",
  xl: "24px",
} as const;

export const FONT_SIZES = {
  xs: "12px",
  sm: "14px",
  md: "16px",
  lg: "18px",
  xl: "24px",
} as const;

export const SIZES = {
  maxWidth: "600px",
  borderRadius: "4px",
} as const;

export const FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
