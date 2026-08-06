import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BagProductDiagram,
  BoxwallProductDiagram,
  FrpProductDiagram,
  GateProductDiagram,
  TubeProductDiagram,
} from "@/constants/tucsenberg-product-page-types";
import {
  ProductDiagramPanel,
  ProductLineDiagram,
} from "@/components/products/product-diagrams";

const boxwallSentinel: BoxwallProductDiagram = {
  kind: "boxwall",
  ariaLabel: "SENTINEL BOXWALL ARIA",
  caption: "SENTINEL BOXWALL CAPTION",
  panelLabel: "SENTINEL PANEL",
  labels: {
    waterSide: "SENTINEL WATER",
    loadSealsBase: "SENTINEL LOAD SEALS",
    profile: "SENTINEL PROFILE",
    load: "SENTINEL LOAD",
    floodSide: "SENTINEL FLOOD",
    drySide: "SENTINEL DRY",
    heightRange: "40–90 cm",
  },
};

const gateSentinel: GateProductDiagram = {
  kind: "gate",
  ariaLabel: "SENTINEL GATE ARIA",
  caption: "SENTINEL GATE CAPTION",
  labels: {
    planks: "SENTINEL PLANKS",
    seal: "SENTINEL SEAL",
    post: "SENTINEL POST",
  },
};

const bagSentinel: BagProductDiagram = {
  kind: "bag",
  ariaLabel: "SENTINEL BAG ARIA",
  caption: "SENTINEL BAG CAPTION",
  labels: {
    shipsFlat: "SENTINEL SHIPS FLAT",
    addWater: "SENTINEL ADD WATER",
    activatedWeight: "SENTINEL ACTIVATED",
    stacking: "SENTINEL STACKING",
  },
};

const tubeSentinel: TubeProductDiagram = {
  kind: "tube",
  ariaLabel: "SENTINEL TUBE ARIA",
  caption: "SENTINEL TUBE CAPTION",
  labels: {
    waterSide: "SENTINEL TUBE WATER",
    skirtAndPins: "SENTINEL SKIRT",
    tubeConstruction: "SENTINEL TUBE BODY",
  },
};

const frpSentinel: FrpProductDiagram = {
  kind: "frp",
  ariaLabel: "SENTINEL FRP ARIA",
  caption: "SENTINEL FRP CAPTION",
  labels: {
    heightClass: "SENTINEL HEIGHT CLASS",
    profile: "SENTINEL FRP PROFILE",
    properties: "SENTINEL FRP PROPERTIES",
  },
};

const sentinelCases = [
  {
    name: "boxwall",
    diagram: boxwallSentinel,
    sentinelTexts: [
      "SENTINEL WATER",
      "SENTINEL LOAD SEALS",
      "SENTINEL PROFILE",
    ],
    embeddedEnglish: [
      "water side",
      "load seals the base",
      "interlocking ABS",
      // The height range is product data now, so a substituted value must win.
      "50–85 cm",
    ],
    dimensionTexts: ["40–90 cm"],
  },
  {
    name: "gate",
    diagram: gateSentinel,
    sentinelTexts: ["SENTINEL PLANKS", "SENTINEL SEAL", "SENTINEL POST"],
    embeddedEnglish: ["6063-T6 planks", "EPDM seal", "post"],
    dimensionTexts: ["180 mm"],
  },
  {
    name: "bag",
    diagram: bagSentinel,
    sentinelTexts: [
      "SENTINEL SHIPS FLAT",
      "SENTINEL ADD WATER",
      "SENTINEL ACTIVATED",
      "SENTINEL STACKING",
    ],
    embeddedEnglish: ["ships flat", "+ water", "stack like sandbags"],
    dimensionTexts: [] as string[],
  },
  {
    name: "tube",
    diagram: tubeSentinel,
    sentinelTexts: [
      "SENTINEL TUBE WATER",
      "SENTINEL SKIRT",
      "SENTINEL TUBE BODY",
    ],
    embeddedEnglish: ["water side", "skirt + pins", "PVC tube"],
    dimensionTexts: ["1 m"],
  },
  {
    name: "frp",
    diagram: frpSentinel,
    sentinelTexts: [
      "SENTINEL HEIGHT CLASS",
      "SENTINEL FRP PROFILE",
      "SENTINEL FRP PROPERTIES",
    ],
    embeddedEnglish: ["pultruded FRP", "corrosion-free"],
    dimensionTexts: [] as string[],
  },
] as const;

describe("ProductLineDiagram", () => {
  it.each(sentinelCases)(
    "renders $name sentinel labels instead of embedded English",
    ({ diagram, sentinelTexts, embeddedEnglish, dimensionTexts }) => {
      const { container } = render(<ProductLineDiagram diagram={diagram} />);

      for (const text of sentinelTexts) {
        expect(container).toHaveTextContent(text);
      }
      for (const text of embeddedEnglish) {
        expect(container).not.toHaveTextContent(text);
      }
      for (const text of dimensionTexts) {
        expect(container).toHaveTextContent(text);
      }
    },
  );
});

describe("ProductDiagramPanel", () => {
  it("renders panel label, caption, and aria label from diagram data", () => {
    render(<ProductDiagramPanel diagram={boxwallSentinel} />);

    const panel = screen.getByTestId("product-diagram");
    expect(within(panel).getByText("SENTINEL PANEL")).toBeVisible();
    expect(within(panel).getByText("SENTINEL BOXWALL CAPTION")).toBeVisible();
    expect(
      within(panel).getByRole("img", { name: "SENTINEL BOXWALL ARIA" }),
    ).toBeInTheDocument();
  });
});

describe("BoxwallCrossSection canvas labels", () => {
  const fillText = vi.fn();
  let matchMediaListeners: Array<() => void> = [];

  beforeEach(() => {
    fillText.mockClear();
    matchMediaListeners = [];

    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: (_event: string, listener: () => void) => {
          matchMediaListeners.push(listener);
        },
        removeEventListener: vi.fn(),
      })),
    );

    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      fill: vi.fn(),
      closePath: vi.fn(),
      fillRect: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      setLineDash: vi.fn(),
      fillText,
      strokeStyle: "",
      fillStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
      font: "",
      textAlign: "left",
      textBaseline: "alphabetic",
      lineJoin: "round",
    } as unknown as CanvasRenderingContext2D);

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 480,
      height: 360,
      top: 0,
      left: 0,
      right: 480,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    vi.spyOn(window, "getComputedStyle").mockReturnValue({
      color: "rgb(0, 0, 0)",
    } as CSSStyleDeclaration);

    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );

    vi.stubGlobal(
      "MutationObserver",
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      },
    );
  });

  it("draws sentinel canvas labels with reduced motion and keeps TB-BW literal", async () => {
    const { BoxwallCrossSection } =
      await import("@/components/products/boxwall-cross-section");

    render(
      <BoxwallCrossSection
        fallback={<svg aria-hidden />}
        labels={{
          load: "SENTINEL LOAD",
          floodSide: "SENTINEL FLOOD",
          drySide: "SENTINEL DRY",
        }}
      />,
    );

    for (const listener of matchMediaListeners) {
      listener();
    }

    expect(fillText).toHaveBeenCalledWith(
      "SENTINEL LOAD",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "SENTINEL FLOOD",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "SENTINEL DRY",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).toHaveBeenCalledWith(
      "TB-BW",
      expect.any(Number),
      expect.any(Number),
    );
    expect(fillText).not.toHaveBeenCalledWith(
      "LOAD",
      expect.any(Number),
      expect.any(Number),
    );
  });
});
