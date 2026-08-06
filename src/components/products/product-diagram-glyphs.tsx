import type { ReactNode } from "react";
import type { TucsenbergProductDiagramKind } from "@/constants/tucsenberg-product-page-types";

const GLYPH_PATHS: Record<TucsenbergProductDiagramKind, ReactNode> = {
  boxwall: (
    <>
      <path d="M 24 8 L 29 8 L 29 30 L 10 30 L 10 26 L 24 26 Z" />
      <path d="M 4 18 q 3 -2.5 6 0 t 6 0" className="text-primary" />
    </>
  ),
  gate: (
    <>
      <rect x={6} y={6} width={4} height={24} />
      <rect x={30} y={6} width={4} height={24} />
      <line x1={10} y1={12} x2={30} y2={12} />
      <line x1={10} y1={19} x2={30} y2={19} />
      <line x1={10} y1={26} x2={30} y2={26} />
    </>
  ),
  bag: (
    <>
      <rect x={6} y={20} width={28} height={10} rx={5} />
      <rect x={12} y={8} width={16} height={5} rx={2.5} />
      <line x1={20} y1={13} x2={20} y2={18} className="text-primary" />
    </>
  ),
  tube: (
    <>
      <circle cx={22} cy={19} r={11} />
      <line x1={4} y1={30} x2={36} y2={30} />
      <path d="M 4 16 q 3 -2.5 6 0" className="text-primary" />
    </>
  ),
  frp: (
    <>
      <rect x={6} y={10} width={28} height={18} rx={2} />
      <line x1={16} y1={10} x2={16} y2={28} />
      <line x1={25} y1={10} x2={25} y2={28} />
    </>
  ),
};

/** Small line glyph for product-line tiles; decorative (aria-hidden). */
export function ProductLineGlyph({
  kind,
  className,
}: {
  kind: TucsenbergProductDiagramKind;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      className={className ?? "size-8 shrink-0"}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 40 36"
    >
      {GLYPH_PATHS[kind]}
    </svg>
  );
}
