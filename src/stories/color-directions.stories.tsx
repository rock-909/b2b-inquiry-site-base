import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

const SCALE_STEPS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "11",
  "12",
] as const;

const HUE_STEEL_BLUE = 240;
const HUE_DEEP_TEAL = 190;
const HUE_INK_NAVY = 258;

type ScaleStep = (typeof SCALE_STEPS)[number];
type TokenScale = Record<ScaleStep, string>;

interface ColorDirection {
  id: string;
  name: string;
  tag: string;
  description: string;
  hue: number;
  css: string;
}

function buildBrandScale(
  hue: number,
  tweaks?: Partial<TokenScale>,
): TokenScale {
  return {
    "1": `oklch(0.985 0.006 ${hue})`,
    "2": `oklch(0.965 0.012 ${hue})`,
    "3": `oklch(0.94 0.02 ${hue})`,
    "4": `oklch(0.9 0.035 ${hue})`,
    "5": `oklch(0.84 0.055 ${hue})`,
    "6": `oklch(0.78 0.07 ${hue})`,
    "7": `oklch(0.7 0.085 ${hue})`,
    "8": `oklch(0.61 0.1 ${hue})`,
    "9": `oklch(0.47 0.12 ${hue})`,
    "10": `oklch(0.4 0.11 ${hue})`,
    "11": `oklch(0.36 0.095 ${hue})`,
    "12": `oklch(0.25 0.06 ${hue})`,
    ...tweaks,
  };
}

function buildNeutralScale(hue: number): TokenScale {
  return {
    "1": `oklch(0.985 0.004 ${hue})`,
    "2": `oklch(0.965 0.006 ${hue})`,
    "3": `oklch(0.94 0.007 ${hue})`,
    "4": `oklch(0.9 0.008 ${hue})`,
    "5": `oklch(0.84 0.009 ${hue})`,
    "6": `oklch(0.76 0.01 ${hue})`,
    "7": `oklch(0.64 0.012 ${hue})`,
    "8": `oklch(0.52 0.014 ${hue})`,
    "9": `oklch(0.42 0.015 ${hue})`,
    "10": `oklch(0.34 0.014 ${hue})`,
    "11": `oklch(0.29 0.013 ${hue})`,
    "12": `oklch(0.22 0.012 ${hue})`,
  };
}

function buildThemeCss(brand: TokenScale, neutral: TokenScale): string {
  const b = brand;
  const n = neutral;

  return `
    --brand-1: ${b["1"]}; --brand-2: ${b["2"]}; --brand-3: ${b["3"]}; --brand-4: ${b["4"]};
    --brand-5: ${b["5"]}; --brand-6: ${b["6"]}; --brand-7: ${b["7"]}; --brand-8: ${b["8"]};
    --brand-9: ${b["9"]}; --brand-10: ${b["10"]}; --brand-11: ${b["11"]}; --brand-12: ${b["12"]};
    --neutral-1: ${n["1"]}; --neutral-2: ${n["2"]}; --neutral-3: ${n["3"]}; --neutral-4: ${n["4"]};
    --neutral-5: ${n["5"]}; --neutral-6: ${n["6"]}; --neutral-7: ${n["7"]}; --neutral-8: ${n["8"]};
    --neutral-9: ${n["9"]}; --neutral-10: ${n["10"]}; --neutral-11: ${n["11"]}; --neutral-12: ${n["12"]};
    --primary: ${b["9"]};
    --primary-foreground: ${n["1"]};
    --primary-dark: ${b["10"]};
    --primary-light: ${b["3"]};
    --primary-50: ${b["2"]};
    --background: ${n["1"]};
    --foreground: ${n["12"]};
    --card: ${n["1"]};
    --card-foreground: ${n["12"]};
    --popover: ${n["1"]};
    --popover-foreground: ${n["12"]};
    --secondary: ${n["1"]};
    --secondary-foreground: ${n["12"]};
    --accent: ${b["3"]};
    --accent-foreground: ${b["11"]};
    --muted: ${n["3"]};
    --muted-foreground: ${n["9"]};
    --border: ${n["4"]};
    --border-light: ${n["3"]};
    --input: ${n["1"]};
    --ring: ${b["8"]};
    --divider: ${n["4"]};
    --color-primary: ${b["9"]};
    --color-primary-foreground: ${n["1"]};
    --color-background: ${n["1"]};
    --color-foreground: ${n["12"]};
    --color-card: ${n["1"]};
    --color-card-foreground: ${n["12"]};
    --color-popover: ${n["1"]};
    --color-popover-foreground: ${n["12"]};
    --color-secondary: ${n["1"]};
    --color-secondary-foreground: ${n["12"]};
    --color-accent: ${b["3"]};
    --color-accent-foreground: ${b["11"]};
    --color-muted: ${n["3"]};
    --color-muted-foreground: ${n["9"]};
    --color-border: ${n["4"]};
    --color-input: ${n["1"]};
    --color-ring: ${b["8"]};
    --button-primary-bg: ${b["9"]};
    --button-primary-fg: ${n["1"]};
    --button-primary-hover-bg: ${b["10"]};
    --button-accent-bg: ${b["3"]};
    --button-accent-fg: ${b["11"]};
    --button-accent-hover-bg: ${b["4"]};
    --button-outline-fg: ${b["9"]};
    --button-outline-border: ${b["9"]};
    --button-outline-hover-bg: color-mix(in oklch, ${b["9"]} 10%, transparent);
    --button-ghost-hover-bg: ${b["3"]};
    --button-secondary-border: ${n["4"]};
    --button-secondary-hover-border: ${n["5"]};
    --shadow-card-active: 0 0 0 1px ${b["9"]}, 0 0 0 4px color-mix(in oklch, ${b["9"]} 12%, transparent);
    --shadow-accent: 0 0 0 3px color-mix(in oklch, ${b["9"]} 20%, transparent);
    --selection-background: color-mix(in oklch, ${b["9"]} 20%, transparent);
    --info: ${b["9"]};
    --info-muted: ${b["2"]};
    --info-border: ${b["5"]};
    --info-foreground: ${b["11"]};
    --footer-bg: ${n["11"]};
    --footer-text: ${n["5"]};
    --footer-heading: ${n["6"]};
    --footer-link: ${n["4"]};
    --grid-guide: color-mix(in oklch, ${n["12"]} 5%, transparent);
    --grid-divider: ${n["4"]};
    --grid-crosshair: ${n["6"]};
    --table-header-bg: ${n["3"]};
    --table-row-hover-bg: color-mix(in oklch, ${b["9"]} 8%, transparent);
  `;
}

const STEEL_BLUE_DIRECTION = {
  id: "steel-blue",
  name: "Steel Blue",
  tag: "当前方案",
  description: "工业标准色 · 安全可靠",
  hue: HUE_STEEL_BLUE,
  css: buildThemeCss(
    buildBrandScale(HUE_STEEL_BLUE),
    buildNeutralScale(HUE_STEEL_BLUE),
  ),
} satisfies ColorDirection;

const DEEP_TEAL_DIRECTION = {
  id: "deep-teal",
  name: "Deep Teal",
  tag: "深水鸭绿",
  description: "精密仪器 · 工程师工作台",
  hue: HUE_DEEP_TEAL,
  css: buildThemeCss(
    buildBrandScale(HUE_DEEP_TEAL, {
      "9": "oklch(0.45 0.105 190)",
      "10": "oklch(0.38 0.095 190)",
      "11": "oklch(0.33 0.08 190)",
    }),
    buildNeutralScale(HUE_DEEP_TEAL),
  ),
} satisfies ColorDirection;

const INK_NAVY_DIRECTION = {
  id: "ink-navy",
  name: "Ink Navy",
  tag: "墨蓝",
  description: "工程蓝图 · 权威沉稳",
  hue: HUE_INK_NAVY,
  css: buildThemeCss(
    buildBrandScale(HUE_INK_NAVY, {
      "9": "oklch(0.42 0.12 258)",
      "10": "oklch(0.35 0.11 258)",
      "11": "oklch(0.30 0.09 258)",
      "12": "oklch(0.22 0.065 258)",
    }),
    buildNeutralScale(HUE_INK_NAVY),
  ),
} satisfies ColorDirection;

const DIRECTIONS = [
  STEEL_BLUE_DIRECTION,
  DEEP_TEAL_DIRECTION,
  INK_NAVY_DIRECTION,
] as const satisfies readonly ColorDirection[];

function ThemeWrapper({
  direction,
  children,
}: {
  direction: ColorDirection;
  children: ReactNode;
}) {
  const themeSelector = `storybook-theme-${direction.id}`;

  return (
    <div
      data-theme-id={themeSelector}
      className="bg-background text-foreground"
    >
      <style>{`[data-theme-id="${themeSelector}"] { ${direction.css} }`}</style>
      {children}
    </div>
  );
}

function PaletteRow({
  label,
  prefix,
}: {
  label: string;
  prefix: "brand" | "neutral";
}) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex gap-1">
        {SCALE_STEPS.map((step) => (
          <div key={step} className="flex flex-col items-center gap-1">
            <div
              className="h-10 w-10 rounded-md shadow-border"
              style={{ backgroundColor: `var(--${prefix}-${step})` }}
            />
            <span className="text-[10px] text-muted-foreground">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SideBySide({ directions }: { directions: readonly ColorDirection[] }) {
  return (
    <div className="flex gap-6 overflow-x-auto p-4">
      {directions.map((direction) => (
        <ThemeWrapper key={direction.id} direction={direction}>
          <div className="w-[420px] shrink-0 space-y-6 rounded-xl border border-border p-6">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold">{direction.name}</h3>
                <span className="text-[10px] text-muted-foreground">
                  {direction.tag}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {direction.description}
              </p>
            </div>
            <PaletteRow label="Brand" prefix="brand" />
            <div className="rounded-lg border border-border p-5">
              <span className="text-[12px] font-semibold tracking-[0.04em] text-primary uppercase">
                Tucsenberg - Flood Barriers - Factory Direct
              </span>
              <h2 className="mt-2 text-xl leading-tight font-extrabold tracking-tight">
                Clear presentation for a five-line product range
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Specs, proof, and the RFQ path stay one click apart.
              </p>
              <div className="mt-4 flex gap-2">
                <Button size="sm">Get quote</Button>
                <Button size="sm" variant="secondary">
                  Products
                </Button>
              </div>
            </div>
            <div className="rounded-lg bg-primary p-5 text-center">
              <h3 className="text-lg font-bold text-primary-foreground">
                Ready to start?
              </h3>
              <div className="mt-3 flex justify-center gap-2">
                <Button variant="on-dark" size="sm">
                  Get quote
                </Button>
                <Button variant="ghost-dark" size="sm">
                  Send drawing
                </Button>
              </div>
            </div>
          </div>
        </ThemeWrapper>
      ))}
    </div>
  );
}

const meta = {
  title: "Design System/Color Directions",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const SideBySideComparison: Story = {
  name: "Side by Side",
  render: () => <SideBySide directions={DIRECTIONS} />,
};
