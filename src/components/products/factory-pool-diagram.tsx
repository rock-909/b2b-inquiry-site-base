/* eslint-disable no-magic-numbers -- SVG drawing coordinates; naming every x/y would hurt readability */
import type { ReactNode } from "react";

export interface FactoryPoolDiagramLabels {
  extrusion: string;
  moulding: string;
  welding: string;
  sewing: string;
  specAndQc: string;
  mixedContainer: string;
}

/**
 * Factory-pool process line drawing for the OEM landing page: four
 * specialised factories feed one spec sheet / QC gate and ship as one mixed
 * container. Same honest engineering-drawing family as product-diagrams.tsx —
 * strokes inherit theme tokens via currentColor.
 */

function FactoryBlock({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <g className="text-foreground" stroke="currentColor" strokeWidth={2}>
      <rect x={x} y={y + 14} width={72} height={44} className="fill-card" />
      {/* Sawtooth factory roof */}
      <path
        d={`M ${x} ${y + 14} L ${x + 12} ${y} L ${x + 24} ${y + 14} L ${x + 36} ${y} L ${x + 48} ${y + 14} L ${x + 60} ${y} L ${x + 72} ${y + 14}`}
        fill="none"
        strokeLinejoin="round"
      />
      <text
        x={x + 36}
        y={y + 74}
        textAnchor="middle"
        stroke="none"
        className="fill-muted-foreground font-mono text-[10px]"
      >
        {label}
      </text>
    </g>
  );
}

function FlowArrow({
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
  return (
    <g
      className="text-muted-foreground"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      <path
        d={`M ${x2} ${y2} L ${x2 - headLength * Math.cos(angle - 0.4)} ${y2 - headLength * Math.sin(angle - 0.4)} M ${x2} ${y2} L ${x2 - headLength * Math.cos(angle + 0.4)} ${y2 - headLength * Math.sin(angle + 0.4)}`}
        fill="none"
      />
    </g>
  );
}

export function FactoryPoolDiagram({
  ariaLabel,
  labels,
}: {
  ariaLabel: string;
  labels: FactoryPoolDiagramLabels;
}): ReactNode {
  return (
    <svg
      aria-label={ariaLabel}
      role="img"
      className="h-auto w-full"
      fill="none"
      viewBox="0 0 480 240"
    >
      {/* Four specialised factories */}
      <FactoryBlock x={16} y={24} label={labels.extrusion} />
      <FactoryBlock x={16} y={132} label={labels.moulding} />
      <FactoryBlock x={108} y={24} label={labels.welding} />
      <FactoryBlock x={108} y={132} label={labels.sewing} />

      {/* Convergence into the spec/QC gate */}
      <FlowArrow x1={192} y1={60} x2={224} y2={104} />
      <FlowArrow x1={192} y1={168} x2={224} y2={128} />

      {/* One spec sheet / one QC standard */}
      <g className="text-foreground" stroke="currentColor" strokeWidth={2}>
        <rect x={232} y={72} width={64} height={88} className="fill-card" />
        <line
          x1={242}
          y1={92}
          x2={286}
          y2={92}
          className="text-primary"
          strokeWidth={3}
        />
        {[106, 118, 130, 142].map((y) => (
          <line key={y} x1={242} y1={y} x2={286} y2={y} strokeWidth={1} />
        ))}
      </g>
      <text
        x={264}
        y={180}
        textAnchor="middle"
        className="fill-muted-foreground font-mono text-[10px]"
      >
        {labels.specAndQc}
      </text>

      <FlowArrow x1={304} y1={116} x2={340} y2={116} />

      {/* Mixed 40'HQ container */}
      <g className="text-foreground" stroke="currentColor" strokeWidth={2}>
        <rect x={348} y={84} width={116} height={64} className="fill-card" />
        {[366, 384, 402, 420, 438].map((x) => (
          <line key={x} x1={x} y1={84} x2={x} y2={148} strokeWidth={1} />
        ))}
      </g>
      <text
        x={406}
        y={172}
        textAnchor="middle"
        className="fill-muted-foreground font-mono text-[10px]"
      >
        {labels.mixedContainer}
      </text>
    </svg>
  );
}
