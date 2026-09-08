import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const THEME_CSS = "src/app/theme.css";
const GLOBALS_CSS = "src/app/globals.css";

const SEMANTIC_COLOR_FILES = [
  "src/components/ui/button.tsx",
  "src/components/forms/inquiry-form.tsx",
  "src/components/security/turnstile.tsx",
  "src/components/footer/footer.tsx",
] as const;

const RAW_PALETTE_CLASS =
  /\b(?:(?:hover|dark|focus-visible):)*(?:bg|text|border|ring|outline)-(?:neutral|gray|slate|zinc|stone|blue|sky|cyan|green|red|amber|yellow|emerald)-\d{2,3}\b/u;

function readRepoFile(filePath: string): string {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- 测试只读取上方固定的仓库文件
  return readFileSync(filePath, "utf8");
}

function stripCssComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//gu, "");
}

describe("design token contract", () => {
  it("keeps theme.css as the semantic token source", () => {
    const globals = stripCssComments(readRepoFile(GLOBALS_CSS));
    const theme = stripCssComments(readRepoFile(THEME_CSS));

    expect(globals).toContain('@import "./theme.css";');

    for (const token of [
      "--background",
      "--foreground",
      "--primary",
      "--primary-foreground",
      "--muted-foreground",
      "--border",
      "--input",
      "--ring",
      "--success-foreground",
      "--warning-foreground",
      "--error-foreground",
      "--info-foreground",
      "--control-radius",
      "--surface-radius",
      "--surface-shadow",
    ]) {
      expect(theme, `${THEME_CSS} should define ${token}`).toContain(
        `${token}:`,
      );
    }
  });

  it("keeps core browser UI on semantic color tokens", () => {
    for (const filePath of SEMANTIC_COLOR_FILES) {
      expect(
        stripCssComments(readRepoFile(filePath)).match(RAW_PALETTE_CLASS),
        `${filePath} should use semantic tokens instead of raw Tailwind palette classes`,
      ).toBeNull();
    }
  });

  it("keeps required WCAG contrast across light and dark themes", () => {
    const css = stripCssComments(readRepoFile(THEME_CSS));
    const pairs = [
      ["--input", "--background", 3],
      ["--input", "--card", 3],
      ["--ring", "--background", 3],
      ["--ring", "--card", 3],
      ["--button-primary-fg", "--button-primary-bg", 4.5],
      ["--primary-text", "--background", 4.5],
      ["--muted-foreground", "--background", 4.5],
      ["--muted-foreground", "--card", 4.5],
      ["--muted-foreground", "--muted", 4.5],
      ["--error-foreground", "--background", 4.5],
      ["--error-foreground", "--card", 4.5],
    ] as const;

    for (const themeName of ["light", "dark"] as const) {
      const tokens = buildThemeTokenMap(css, themeName);

      for (const [foreground, background, minimum] of pairs) {
        expect(
          contrastRatio(
            resolveOklchColor(tokens, foreground),
            resolveOklchColor(tokens, background),
          ),
          `${themeName} ${foreground} vs ${background}`,
        ).toBeGreaterThanOrEqual(minimum);
      }
    }
  });
});

function extractSelectorBodies(css: string, selector: string): string[] {
  const bodies: string[] = [];
  // eslint-disable-next-line security/detect-non-literal-regexp -- selector 只来自下方固定主题选择器
  const pattern = new RegExp(
    `${selector.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{`,
    "gu",
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
  for (const match of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/gu)) {
    const name = match[1];
    const value = match[2]?.trim();
    if (name && value) declarations.set(name, value);
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
  if (!raw) throw new Error(`Missing token ${tokenName}`);

  const varMatch = raw.match(/^var\((--[\w-]+)\)$/u);
  if (varMatch?.[1]) {
    return resolveOklchColor(tokens, varMatch[1], depth + 1);
  }

  const oklchMatch = raw.match(
    /^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/u,
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

function relativeLuminance(rgb: [number, number, number]): number {
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
): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}
