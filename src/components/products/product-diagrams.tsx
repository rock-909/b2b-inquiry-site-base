/* eslint-disable no-magic-numbers -- SVG drawing coordinates */
import type { ReactNode } from "react";
import type {
  BagDiagramLabels,
  BoxwallDiagramLabels,
  FrpDiagramLabels,
  GateDiagramLabels,
  TubeDiagramLabels,
  TucsenbergProductDiagram,
} from "@/constants/tucsenberg-product-page-types";
import { BoxwallCrossSection } from "@/components/products/boxwall-cross-section";

export { ProductLineGlyph } from "@/components/products/product-diagram-glyphs";

const GATE_PLANK_HEIGHT = 38;
const GATE_PLANK_GAP = 5;
const GATE_PLANK_BOTTOMS = [222, 179, 136, 93];

function DiagramSvg({
  ariaLabel,
  children,
}: {
  ariaLabel: string;
  children: ReactNode;
}) {
  return (
    <svg
      aria-label={ariaLabel}
      className="h-auto w-full"
      fill="none"
      role="img"
      viewBox="0 0 480 320"
    >
      {children}
    </svg>
  );
}

function GroundLine({ y = 260 }: { y?: number }) {
  return (
    <g className="text-foreground/70" stroke="currentColor" strokeWidth={2}>
      <line x1={24} y1={y} x2={456} y2={y} />
      {Array.from({ length: 14 }, (_, i) => 40 + i * 30).map((x) => (
        <line key={x} x1={x} y1={y} x2={x - 8} y2={y + 8} strokeWidth={1} />
      ))}
    </g>
  );
}

function WaterBody({
  x,
  width,
  level,
  floor = 260,
}: {
  x: number;
  width: number;
  level: number;
  floor?: number;
}) {
  const wave = `M ${x} ${level} ${"q 6 -5 12 0 t 12 0 ".repeat(
    Math.floor(width / 24),
  )}`;
  return (
    <g className="text-primary">
      <rect
        x={x}
        y={level}
        width={width}
        height={floor - level}
        className="fill-primary/10"
      />
      <path d={wave} stroke="currentColor" strokeWidth={2} />
    </g>
  );
}

function DimLine({
  x,
  y1,
  y2,
  label,
}: {
  x: number;
  y1: number;
  y2: number;
  label: string;
}) {
  return (
    <g className="text-muted-foreground" stroke="currentColor" strokeWidth={1}>
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 5} y1={y1} x2={x + 5} y2={y1} />
      <line x1={x - 5} y1={y2} x2={x + 5} y2={y2} />
      <text
        x={x + 10}
        y={(y1 + y2) / 2}
        className="fill-current font-mono"
        fontSize={11}
        stroke="none"
      >
        {label}
      </text>
    </g>
  );
}

function Annotation({
  x,
  y,
  children,
  anchor = "start",
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      className="fill-muted-foreground"
      fontSize={11}
      textAnchor={anchor}
    >
      {children}
    </text>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const headLength = 7;
  const left = angle + Math.PI * 0.85;
  const right = angle - Math.PI * 0.85;
  return (
    <g className="text-primary" stroke="currentColor" strokeWidth={2}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <line
        x1={x2}
        y1={y2}
        x2={x2 + headLength * Math.cos(left)}
        y2={y2 + headLength * Math.sin(left)}
      />
      <line
        x1={x2}
        y1={y2}
        x2={x2 + headLength * Math.cos(right)}
        y2={y2 + headLength * Math.sin(right)}
      />
    </g>
  );
}

function BoxwallDiagram({
  ariaLabel,
  labels,
}: {
  ariaLabel: string;
  labels: BoxwallDiagramLabels;
}) {
  return (
    <DiagramSvg ariaLabel={ariaLabel}>
      <WaterBody x={24} width={256} level={168} />
      <GroundLine />
      <path
        d="M 280 84 L 298 84 L 298 260 L 180 260 L 180 246 L 280 246 Z"
        className="fill-card text-foreground"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <Arrow x1={224} y1={205} x2={268} y2={205} />
      <Arrow x1={210} y1={210} x2={210} y2={240} />
      <Arrow x1={244} y1={210} x2={244} y2={240} />
      <DimLine x={330} y1={84} y2={260} label={labels.heightRange} />
      <Annotation x={30} y={156}>
        {labels.waterSide}
      </Annotation>
      <Annotation x={196} y={232}>
        {labels.loadSealsBase}
      </Annotation>
      <Annotation x={470} y={76} anchor="end">
        {labels.profile}
      </Annotation>
    </DiagramSvg>
  );
}

function GateDiagram({
  ariaLabel,
  labels,
}: {
  ariaLabel: string;
  labels: GateDiagramLabels;
}) {
  return (
    <DiagramSvg ariaLabel={ariaLabel}>
      <GroundLine />
      {[118, 348].map((x) => (
        <rect
          key={x}
          x={x}
          y={64}
          width={14}
          height={196}
          className="fill-muted text-foreground"
          stroke="currentColor"
          strokeWidth={2}
        />
      ))}
      {GATE_PLANK_BOTTOMS.map((y) => (
        <rect
          key={y}
          x={132}
          y={y}
          width={216}
          height={GATE_PLANK_HEIGHT}
          className="fill-card text-foreground"
          stroke="currentColor"
          strokeWidth={2}
        />
      ))}
      {GATE_PLANK_BOTTOMS.slice(0, 3).map((y) => (
        <line
          key={`seal-${y}`}
          x1={134}
          y1={y - GATE_PLANK_GAP + 2}
          x2={346}
          y2={y - GATE_PLANK_GAP + 2}
          className="text-primary"
          stroke="currentColor"
          strokeWidth={3}
          strokeDasharray="8 6"
        />
      ))}
      <DimLine x={382} y1={222} y2={222 + GATE_PLANK_HEIGHT} label="180 mm" />
      <Annotation x={132} y={54}>
        {labels.planks}
      </Annotation>
      <Annotation x={356} y={130}>
        {labels.seal}
      </Annotation>
      <Annotation x={62} y={170} anchor="middle">
        {labels.post}
      </Annotation>
    </DiagramSvg>
  );
}

function BagDiagram({
  ariaLabel,
  labels,
}: {
  ariaLabel: string;
  labels: BagDiagramLabels;
}) {
  return (
    <DiagramSvg ariaLabel={ariaLabel}>
      <rect
        x={52}
        y={120}
        width={128}
        height={16}
        rx={8}
        className="fill-card text-foreground"
        stroke="currentColor"
        strokeWidth={2}
      />
      <Annotation x={116} y={110} anchor="middle">
        {labels.shipsFlat}
      </Annotation>
      <Arrow x1={196} y1={128} x2={252} y2={128} />
      <Annotation x={224} y={112} anchor="middle">
        {labels.addWater}
      </Annotation>
      <rect
        x={268}
        y={94}
        width={148}
        height={64}
        rx={30}
        className="fill-primary/10 text-foreground"
        stroke="currentColor"
        strokeWidth={2}
      />
      <Annotation x={342} y={84} anchor="middle">
        {labels.activatedWeight}
      </Annotation>
      <GroundLine y={272} />
      {[
        [120, 250],
        [212, 250],
        [304, 250],
        [166, 228],
        [258, 228],
      ].map(([x, y]) => (
        <rect
          key={`${x}-${y}`}
          x={x}
          y={y}
          width={88}
          height={22}
          rx={11}
          className="fill-card text-foreground"
          stroke="currentColor"
          strokeWidth={2}
        />
      ))}
      <Annotation x={240} y={296} anchor="middle">
        {labels.stacking}
      </Annotation>
    </DiagramSvg>
  );
}

function TubeDiagram({
  ariaLabel,
  labels,
}: {
  ariaLabel: string;
  labels: TubeDiagramLabels;
}) {
  return (
    <DiagramSvg ariaLabel={ariaLabel}>
      <WaterBody x={24} width={180} level={186} floor={252} />
      <GroundLine y={252} />
      <line
        x1={128}
        y1={252}
        x2={392}
        y2={252}
        className="text-foreground"
        stroke="currentColor"
        strokeWidth={4}
      />
      <circle
        cx={280}
        cy={192}
        r={60}
        className="fill-card text-foreground"
        stroke="currentColor"
        strokeWidth={2}
      />
      {[146, 182].map((x) => (
        <path
          key={x}
          d={`M ${x} 252 l 6 -12 l 6 12 Z`}
          className="fill-primary text-primary"
          stroke="currentColor"
        />
      ))}
      <Arrow x1={168} y1={214} x2={212} y2={214} />
      <DimLine x={368} y1={132} y2={252} label="1 m" />
      <Annotation x={30} y={174}>
        {labels.waterSide}
      </Annotation>
      <Annotation x={132} y={236}>
        {labels.skirtAndPins}
      </Annotation>
      <Annotation x={244} y={120}>
        {labels.tubeConstruction}
      </Annotation>
    </DiagramSvg>
  );
}

function FrpDiagram({
  ariaLabel,
  labels,
}: {
  ariaLabel: string;
  labels: FrpDiagramLabels;
}) {
  return (
    <DiagramSvg ariaLabel={ariaLabel}>
      <rect
        x={120}
        y={104}
        width={240}
        height={112}
        rx={8}
        className="fill-card text-foreground"
        stroke="currentColor"
        strokeWidth={2.5}
      />
      {[180, 240, 300].map((x) => (
        <line
          key={x}
          x1={x}
          y1={106}
          x2={x}
          y2={214}
          className="text-foreground"
          stroke="currentColor"
          strokeWidth={2}
        />
      ))}
      {[132, 150, 168].map((x) => (
        <line
          key={`hatch-${x}`}
          x1={x}
          y1={198}
          x2={x + 14}
          y2={212}
          className="text-primary"
          stroke="currentColor"
          strokeWidth={1.5}
        />
      ))}
      <DimLine x={392} y1={104} y2={216} label={labels.heightClass} />
      <Annotation x={120} y={92}>
        {labels.profile}
      </Annotation>
      <Annotation x={240} y={248} anchor="middle">
        {labels.properties}
      </Annotation>
    </DiagramSvg>
  );
}

function renderProductDiagram(diagram: TucsenbergProductDiagram): ReactNode {
  switch (diagram.kind) {
    case "boxwall":
      return (
        <BoxwallDiagram ariaLabel={diagram.ariaLabel} labels={diagram.labels} />
      );
    case "gate":
      return (
        <GateDiagram ariaLabel={diagram.ariaLabel} labels={diagram.labels} />
      );
    case "bag":
      return (
        <BagDiagram ariaLabel={diagram.ariaLabel} labels={diagram.labels} />
      );
    case "tube":
      return (
        <TubeDiagram ariaLabel={diagram.ariaLabel} labels={diagram.labels} />
      );
    case "frp":
      return (
        <FrpDiagram ariaLabel={diagram.ariaLabel} labels={diagram.labels} />
      );
    default: {
      const exhaustive: never = diagram;
      throw new Error(`Unhandled product diagram kind: ${String(exhaustive)}`);
    }
  }
}

export function ProductLineDiagram({
  diagram,
}: {
  diagram: TucsenbergProductDiagram;
}) {
  return renderProductDiagram(diagram);
}

export function ProductDiagramPanel({
  diagram,
}: {
  diagram: TucsenbergProductDiagram;
}) {
  const staticDrawing = renderProductDiagram(diagram);
  return (
    <figure
      className="min-w-0 rounded-2xl border border-border bg-card p-4 md:p-5"
      data-testid="product-diagram"
    >
      {diagram.panelLabel ? (
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-border pb-3">
          <span className="font-mono text-[10px] font-semibold tracking-[0.1em] text-muted-foreground uppercase">
            {diagram.panelLabel}
          </span>
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
        </div>
      ) : null}
      {diagram.animated && diagram.kind === "boxwall" ? (
        <BoxwallCrossSection
          fallback={staticDrawing}
          labels={{
            load: diagram.labels.load,
            floodSide: diagram.labels.floodSide,
            drySide: diagram.labels.drySide,
          }}
        />
      ) : (
        staticDrawing
      )}
      <figcaption className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted-foreground">
        {diagram.caption}
      </figcaption>
    </figure>
  );
}
