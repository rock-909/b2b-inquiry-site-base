import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const GLOBALS_CSS = "src/app/globals.css";
const FOOTER_COMPONENT_SOURCE = "src/components/footer/footer.tsx";

const RAW_COLOR_PRODUCTION_FILES = [
  "src/components/ui/button.tsx",
  "src/components/forms/inquiry-form.tsx",
  "src/components/security/turnstile.tsx",
  FOOTER_COMPONENT_SOURCE,
] as const;

const BANNED_RAW_BRAND_PALETTE_CLASS_PATTERN =
  /\b(?:bg|text|border|ring|outline)-(?:sky|cyan)-\d{2,3}\b/;

const BANNED_RAW_STATUS_PALETTE_CLASS_PATTERN =
  /\b(?:bg|text|border|ring|outline)-(?:green|red|amber|yellow|emerald)-\d{2,3}\b/;

const BANNED_RAW_INFO_PALETTE_CLASS_PATTERN =
  /\b(?:bg|text|border|ring|outline)-(?:blue|sky|cyan)-\d{2,3}\b/;

const BANNED_INLINE_BRAND_PATTERN =
  /#004d9e|#003b7a|rgba\(\s*0\s*,\s*77\s*,\s*158\b/i;

const BANNED_FOOTER_RAW_PALETTE_CLASS_PATTERN =
  /\b(?:(?:hover|dark|focus-visible):)*(?:bg|text|border|ring|outline)-(?:neutral|gray|slate|zinc|stone|blue|sky|cyan|green|red|amber|yellow|emerald)-\d{2,3}\b/;

function readRepoFile(filePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo files
  if (!existsSync(filePath)) {
    throw new Error(`Missing expected file: ${filePath}`);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename -- architecture test reads fixed repo files
  return readFileSync(filePath, "utf8");
}

function stripCssComments(source: string) {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, "");
}

function extractHighContrastBlocks(css: string) {
  const marker = "@media (prefers-contrast: high)";
  const blocks: string[] = [];
  let searchStartIndex = 0;

  while (searchStartIndex < css.length) {
    const startIndex = css.indexOf(marker, searchStartIndex);

    if (startIndex === -1) {
      break;
    }

    const blockStart = css.indexOf("{", startIndex);

    if (blockStart === -1) {
      break;
    }

    let depth = 0;

    for (let index = blockStart; index < css.length; index += 1) {
      const character = css[index];

      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;

        if (depth === 0) {
          blocks.push(css.slice(startIndex, index + 1));
          searchStartIndex = index + 1;
          break;
        }
      }
    }
  }

  return blocks;
}

function findHighContrastOverrideBlock(blocks: readonly string[]) {
  return (
    blocks.find(
      (block) =>
        block.includes("--ring") ||
        block.includes("*:focus-visible") ||
        block.includes('button, [role="button"]'),
    ) ?? null
  );
}

describe("design token contract", () => {
  it("keeps selected production UI files off raw brand palette classes", () => {
    for (const filePath of RAW_COLOR_PRODUCTION_FILES) {
      const source = stripCssComments(readRepoFile(filePath));

      expect(
        source.match(BANNED_RAW_BRAND_PALETTE_CLASS_PATTERN),
        `${filePath} should route brand color usage through --primary or other brand semantic tokens instead of raw Tailwind sky/cyan palette classes`,
      ).toBeNull();
    }
  });

  it("keeps selected production UI files off raw status palette classes", () => {
    for (const filePath of RAW_COLOR_PRODUCTION_FILES) {
      const source = stripCssComments(readRepoFile(filePath));

      expect(
        source.match(BANNED_RAW_STATUS_PALETTE_CLASS_PATTERN),
        `${filePath} should route success/warning/error states through semantic status tokens instead of raw Tailwind green/red/amber/yellow/emerald palette classes`,
      ).toBeNull();
    }
  });

  it("keeps selected production UI files off raw info palette classes", () => {
    for (const filePath of RAW_COLOR_PRODUCTION_FILES) {
      const source = stripCssComments(readRepoFile(filePath));

      expect(
        source.match(BANNED_RAW_INFO_PALETTE_CLASS_PATTERN),
        `${filePath} should route info or submitting states through --info-* semantic tokens instead of raw Tailwind blue/sky/cyan palette classes`,
      ).toBeNull();
    }
  });

  it("keeps selected production UI files from embedding old brand color values", () => {
    for (const filePath of RAW_COLOR_PRODUCTION_FILES) {
      const source = stripCssComments(readRepoFile(filePath));

      expect(
        source.match(BANNED_INLINE_BRAND_PATTERN),
        `${filePath} should not embed the old steel-blue value directly`,
      ).toBeNull();
    }
  });

  it("keeps footer browser UI config off raw Tailwind palette classes", () => {
    const source = stripCssComments(readRepoFile(FOOTER_COMPONENT_SOURCE));

    expect(
      source.match(BANNED_FOOTER_RAW_PALETTE_CLASS_PATTERN),
      `${FOOTER_COMPONENT_SOURCE} should use semantic tokens instead of raw Tailwind palette classes because it feeds browser-rendered footer UI`,
    ).toBeNull();
  });

  it("does not keep old brand color values in the browser runtime CSS", () => {
    const css = stripCssComments(readRepoFile(GLOBALS_CSS));

    expect(
      css.match(BANNED_INLINE_BRAND_PATTERN),
      `${GLOBALS_CSS} should not keep old brand hex or rgba values, including high-contrast overrides`,
    ).toBeNull();
  });

  it("keeps high contrast overrides off old brand values", () => {
    const css = stripCssComments(readRepoFile(GLOBALS_CSS));
    const highContrastBlocks = extractHighContrastBlocks(css);
    const highContrastOverrideBlock =
      findHighContrastOverrideBlock(highContrastBlocks);

    expect(
      highContrastBlocks.length,
      `${GLOBALS_CSS} should define at least one @media (prefers-contrast: high) block`,
    ).toBeGreaterThan(0);

    expect(
      highContrastOverrideBlock,
      `${GLOBALS_CSS} should include a high contrast override block for --ring or focus-visible states`,
    ).toBeTruthy();

    for (const block of highContrastBlocks) {
      expect(
        block.match(BANNED_INLINE_BRAND_PATTERN),
        `${GLOBALS_CSS} high contrast blocks should not keep old brand hex or rgba values`,
      ).toBeNull();
    }
  });

  it("keeps WCAG AA contrast for input, ring, primary button and primary text", () => {
    const css = stripCssComments(readRepoFile(GLOBALS_CSS));
    const light = buildThemeTokenMap(css, "light");
    const dark = buildThemeTokenMap(css, "dark");

    for (const [themeName, tokens] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      const background = resolveOklchColor(tokens, "--background");
      const card = resolveOklchColor(tokens, "--card");
      const input = resolveOklchColor(tokens, "--input");
      const ring = resolveOklchColor(tokens, "--ring");
      const buttonFg = resolveOklchColor(tokens, "--button-primary-fg");
      const buttonBg = resolveOklchColor(tokens, "--button-primary-bg");
      const primaryText = resolveOklchColor(tokens, "--primary-text");

      expect(
        contrastRatio(input, background),
        `${themeName} --input vs --background`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(input, card),
        `${themeName} --input vs --card`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(ring, background),
        `${themeName} --ring vs --background`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(ring, card),
        `${themeName} --ring vs --card`,
      ).toBeGreaterThanOrEqual(3);
      expect(
        contrastRatio(buttonFg, buttonBg),
        `${themeName} --button-primary-fg vs --button-primary-bg`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(primaryText, background),
        `${themeName} --primary-text vs --background`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps WCAG AA contrast for muted foreground on background, card, and muted surfaces", () => {
    const css = stripCssComments(readRepoFile(GLOBALS_CSS));
    const light = buildThemeTokenMap(css, "light");
    const dark = buildThemeTokenMap(css, "dark");

    for (const [themeName, tokens] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      const mutedForeground = resolveOklchColor(tokens, "--muted-foreground");
      const background = resolveOklchColor(tokens, "--background");
      const card = resolveOklchColor(tokens, "--card");
      const muted = resolveOklchColor(tokens, "--muted");

      expect(
        contrastRatio(mutedForeground, background),
        `${themeName} --muted-foreground vs --background`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(mutedForeground, card),
        `${themeName} --muted-foreground vs --card`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(mutedForeground, muted),
        `${themeName} --muted-foreground vs --muted`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keeps WCAG AA contrast for field error text on form surfaces", () => {
    const css = stripCssComments(readRepoFile(GLOBALS_CSS));
    const light = buildThemeTokenMap(css, "light");
    const dark = buildThemeTokenMap(css, "dark");

    for (const [themeName, tokens] of [
      ["light", light],
      ["dark", dark],
    ] as const) {
      const errorForeground = resolveOklchColor(tokens, "--error-foreground");
      const background = resolveOklchColor(tokens, "--background");
      const card = resolveOklchColor(tokens, "--card");

      expect(
        contrastRatio(errorForeground, background),
        `${themeName} --error-foreground vs --background`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(errorForeground, card),
        `${themeName} --error-foreground vs --card`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});

function extractSelectorBodies(css: string, selector: string): string[] {
  const bodies: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-regexp -- selectors are fixed test inputs
  const pattern = new RegExp(
    `${selector.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`,
    "g",
  );

  for (const match of css.matchAll(pattern)) {
    const braceStart = match.index + match[0].length - 1;
    let depth = 0;

    for (let index = braceStart; index < css.length; index += 1) {
      const character = css[index];
      if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          bodies.push(css.slice(braceStart + 1, index));
          break;
        }
      }
    }
  }

  return bodies;
}

function parseCssDeclarations(body: string): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const name = match[1];
    const value = match[2]?.trim();
    if (name && value) {
      declarations.set(name, value);
    }
  }
  return declarations;
}

function buildThemeTokenMap(
  css: string,
  theme: "light" | "dark",
): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const body of extractSelectorBodies(css, ":root")) {
    for (const [name, value] of parseCssDeclarations(body)) {
      tokens.set(name, value);
    }
  }
  if (theme === "dark") {
    for (const body of extractSelectorBodies(css, ".dark")) {
      for (const [name, value] of parseCssDeclarations(body)) {
        tokens.set(name, value);
      }
    }
  }
  return tokens;
}

function resolveOklchColor(
  tokens: Map<string, string>,
  tokenName: string,
  depth = 0,
): [number, number, number] {
  if (depth > 20) {
    throw new Error(`Token resolution exceeded depth for ${tokenName}`);
  }
  const raw = tokens.get(tokenName);
  if (!raw) {
    throw new Error(`Missing token ${tokenName}`);
  }
  const varMatch = raw.match(/^var\((--[\w-]+)\)$/);
  if (varMatch?.[1]) {
    return resolveOklchColor(tokens, varMatch[1], depth + 1);
  }
  const oklchMatch = raw.match(
    /^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/,
  );
  if (!oklchMatch) {
    throw new Error(`Token ${tokenName} did not resolve to oklch: ${raw}`);
  }
  return oklchToSrgb(
    Number(oklchMatch[1]),
    Number(oklchMatch[2]),
    Number(oklchMatch[3]),
  );
}

function oklchToSrgb(
  lightness: number,
  chroma: number,
  hueDegrees: number,
): [number, number, number] {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);
  const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
  const l = lPrime ** 3;
  const m = mPrime ** 3;
  const s = sPrime ** 3;
  const linearR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const linearG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const linearB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  const toSrgbChannel = (channel: number) => {
    const absolute = Math.abs(channel);
    const signed = channel < 0 ? -1 : 1;
    const encoded =
      absolute > 0.0031308
        ? 1.055 * absolute ** (1 / 2.4) - 0.055
        : 12.92 * absolute;
    return Math.min(1, Math.max(0, signed * encoded));
  };

  return [
    toSrgbChannel(linearR),
    toSrgbChannel(linearG),
    toSrgbChannel(linearB),
  ];
}

function relativeLuminance(rgb: [number, number, number]) {
  const toLinear = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  return (
    0.2126 * toLinear(rgb[0]) +
    0.7152 * toLinear(rgb[1]) +
    0.0722 * toLinear(rgb[2])
  );
}

function contrastRatio(
  first: [number, number, number],
  second: [number, number, number],
) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}
