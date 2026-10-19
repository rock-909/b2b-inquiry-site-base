import { describe, expect, it } from "vitest";
import { STATIC_THEME_COLORS } from "@/config/static-theme-colors";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

describe("static theme colors", () => {
  it("exposes email-safe sRGB values for non-CSS surfaces", () => {
    expect(Object.keys(STATIC_THEME_COLORS).sort()).toEqual([
      "background",
      "border",
      "contentBackground",
      "headerText",
      "muted",
      "primaryText",
      "success",
      "successLight",
      "text",
      "textLight",
    ]);
  });

  it("keeps every exported value as a full hex color", () => {
    for (const [name, value] of Object.entries(STATIC_THEME_COLORS)) {
      expect(value, name).toMatch(HEX_COLOR_PATTERN);
    }
  });
});
