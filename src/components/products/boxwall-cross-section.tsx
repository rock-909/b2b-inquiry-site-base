/* eslint-disable no-magic-numbers -- canvas drawing coordinates in a fixed 480×360 design space; naming every x/y would hurt readability */
"use client";

import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";

/**
 * TB-BW self-anchoring principle, drawn live on Canvas 2D: only the water
 * surface moves (two slow sine waves, "light breathing" tier); the barrier,
 * arrows, scale and labels stay still. Spec:
 * docs/design/设计真相.md.
 *
 * The canvas is a visual enhancement only (aria-hidden); the physical story
 * lives in the panel's caption text. Before hydration — and whenever JS does
 * not run — the server-rendered static SVG fallback stays visible.
 */

interface BoxwallCanvasLabels {
  load: string;
  floodSide: string;
  drySide: string;
}

interface SceneColors {
  ink: string;
  muted: string;
  line: string;
  water: string;
  accent: string;
  card: string;
}

const DESIGN_WIDTH = 480;
const DESIGN_HEIGHT = 360;

// Vertical scale: 0 mm at the ground line, 600 mm at the top tick.
const GROUND_Y = 300;
const SCALE_TOP_Y = 90;
const SCALE_MAX_MM = 600;
const DESIGN_HEAD_MM = 450;

const WALL_LEFT = 352;
const WALL_RIGHT = 368;
const WALL_TOP_Y = 84;
const APRON_TIP_X = 250;
const APRON_ROOT_Y = 284;
const PLOT_LEFT = 56;
const PLOT_RIGHT = 456;
const WATER_LEFT = 16;

function mmToY(mm: number): number {
  return GROUND_Y - (mm / SCALE_MAX_MM) * (GROUND_Y - SCALE_TOP_Y);
}

function resolveColors(el: HTMLElement): SceneColors {
  // The global reduced-motion rule sets `transition-duration: 0.01ms` on all
  // elements; reading a just-set color mid-transition returns the stale
  // starting value, so transitions must be off while probing.
  el.style.setProperty("transition", "none", "important");
  const probe = (variable: string): string => {
    el.style.color = `var(${variable})`;
    return getComputedStyle(el).color;
  };
  const colors: SceneColors = {
    ink: probe("--foreground"),
    muted: probe("--muted-foreground"),
    line: probe("--border"),
    water: probe("--primary"),
    accent: probe("--primary"),
    card: probe("--card"),
  };
  el.style.color = "";
  el.style.removeProperty("transition");
  return colors;
}

function waterSurfaceY(x: number, t: number): number {
  const base = mmToY(DESIGN_HEAD_MM);
  return (
    base + 3 * Math.sin(x * 0.018 + t * 0.9) + 2 * Math.sin(x * 0.031 - t * 0.6)
  );
}

function drawScaleAndGrid(ctx: CanvasRenderingContext2D, c: SceneColors) {
  ctx.font = "600 9px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (const mm of [0, 150, 300, 450, 600]) {
    const y = mmToY(mm);
    ctx.strokeStyle = c.line;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PLOT_LEFT, y);
    ctx.lineTo(PLOT_RIGHT, y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = c.muted;
    ctx.beginPath();
    ctx.moveTo(PLOT_LEFT - 6, y);
    ctx.lineTo(PLOT_LEFT, y);
    ctx.stroke();
    ctx.fillStyle = c.muted;
    ctx.fillText(String(mm), PLOT_LEFT - 10, y);
  }
}

function traceWaterSurface(ctx: CanvasRenderingContext2D, t: number) {
  ctx.beginPath();
  ctx.moveTo(WATER_LEFT, waterSurfaceY(WATER_LEFT, t));
  for (let x = WATER_LEFT + 4; x <= WALL_LEFT; x += 4) {
    ctx.lineTo(x, waterSurfaceY(x, t));
  }
}

function drawDesignHeadLine(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.setLineDash([6, 5]);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  ctx.moveTo(WATER_LEFT, mmToY(DESIGN_HEAD_MM));
  ctx.lineTo(PLOT_RIGHT, mmToY(DESIGN_HEAD_MM));
  ctx.stroke();
  ctx.restore();
}

function drawWater(ctx: CanvasRenderingContext2D, c: SceneColors, t: number) {
  traceWaterSurface(ctx, t);
  ctx.lineTo(WALL_LEFT, GROUND_Y);
  ctx.lineTo(WATER_LEFT, GROUND_Y);
  ctx.closePath();
  ctx.fillStyle = c.water;
  ctx.globalAlpha = 0.1;
  ctx.fill();
  ctx.globalAlpha = 1;

  traceWaterSurface(ctx, t);
  ctx.strokeStyle = c.water;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawDesignHeadLine(ctx);
}

function drawBarrier(ctx: CanvasRenderingContext2D, c: SceneColors) {
  // L-profile: vertical wall + wedge apron tapering left under the water.
  ctx.beginPath();
  ctx.moveTo(WALL_RIGHT, WALL_TOP_Y);
  ctx.lineTo(WALL_RIGHT, GROUND_Y);
  ctx.lineTo(APRON_TIP_X, GROUND_Y);
  ctx.lineTo(WALL_LEFT, APRON_ROOT_Y);
  ctx.lineTo(WALL_LEFT, WALL_TOP_Y);
  ctx.closePath();
  ctx.fillStyle = c.card;
  ctx.fill();
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Accent cap + series label.
  ctx.fillStyle = c.accent;
  ctx.fillRect(WALL_LEFT - 3, WALL_TOP_Y - 5, WALL_RIGHT - WALL_LEFT + 6, 5);
  ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("TB-BW", WALL_RIGHT + 8, WALL_TOP_Y + 2);
}

function drawGround(ctx: CanvasRenderingContext2D, c: SceneColors) {
  ctx.strokeStyle = c.ink;
  ctx.globalAlpha = 0.7;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(WATER_LEFT, GROUND_Y);
  ctx.lineTo(PLOT_RIGHT + 8, GROUND_Y);
  ctx.stroke();
  ctx.lineWidth = 1;
  for (let x = WATER_LEFT + 16; x <= PLOT_RIGHT; x += 30) {
    ctx.beginPath();
    ctx.moveTo(x, GROUND_Y);
    ctx.lineTo(x - 8, GROUND_Y + 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawLoadArrows(
  ctx: CanvasRenderingContext2D,
  c: SceneColors,
  labels: BoxwallCanvasLabels,
) {
  ctx.strokeStyle = c.water;
  ctx.fillStyle = c.water;
  ctx.lineWidth = 2;
  for (const x of [268, 290, 312, 334]) {
    ctx.beginPath();
    ctx.moveTo(x, 216);
    ctx.lineTo(x, 262);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 4, 256);
    ctx.lineTo(x, 264);
    ctx.lineTo(x + 4, 256);
    ctx.closePath();
    ctx.fill();
  }
  ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(labels.load, 268, 202);
}

function drawSideLabels(
  ctx: CanvasRenderingContext2D,
  c: SceneColors,
  labels: BoxwallCanvasLabels,
) {
  ctx.font = "600 10px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = c.water;
  ctx.fillText(labels.floodSide, 68, 122);
  ctx.fillStyle = c.muted;
  ctx.fillText(labels.drySide, WALL_RIGHT + 8, 122);
}

function drawScene({
  ctx,
  colors,
  labels,
  t,
}: {
  ctx: CanvasRenderingContext2D;
  colors: SceneColors;
  labels: BoxwallCanvasLabels;
  t: number;
}) {
  drawScaleAndGrid(ctx, colors);
  drawWater(ctx, colors, t);
  drawBarrier(ctx, colors);
  drawGround(ctx, colors);
  drawLoadArrows(ctx, colors, labels);
  drawSideLabels(ctx, colors, labels);
}

// eslint-disable-next-line no-empty-function -- store never changes; unsubscribe is intentionally a no-op
const noop = () => {};
const subscribeNoop = () => noop;

export function BoxwallCrossSection({
  fallback,
  labels,
}: {
  fallback: ReactNode;
  labels: BoxwallCanvasLabels;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // false during SSR/hydration (static SVG fallback), true once client-only
  // rendering is safe — the recommended useSyncExternalStore mounted gate.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!mounted) return undefined;
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!container || !canvas || !ctx) return undefined;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let colors = resolveColors(canvas);
    let rafId = 0;

    // Containers can resize after fonts/layout settle; re-measure on every
    // render instead of trusting a single initial measurement.
    const render = (t: number) => {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0) return;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);
      ctx.setTransform(
        scale,
        0,
        0,
        scale,
        (width - DESIGN_WIDTH * scale) / 2,
        (height - DESIGN_HEIGHT * scale) / 2,
      );
      drawScene({ ctx, colors, labels, t });
    };

    const loop = (now: number) => {
      render(now / 1000);
      rafId = requestAnimationFrame(loop);
    };
    const start = () => {
      cancelAnimationFrame(rafId);
      if (media.matches) {
        // Reduced motion: freeze the water as a static curve, zero info loss.
        render(0);
      } else {
        rafId = requestAnimationFrame(loop);
      }
    };

    const resizeObserver = new ResizeObserver(() => {
      if (media.matches) render(0);
    });
    resizeObserver.observe(container);

    const themeObserver = new MutationObserver(() => {
      colors = resolveColors(canvas);
      if (media.matches) render(0);
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme", "style"],
    });

    media.addEventListener("change", start);
    start();

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      themeObserver.disconnect();
      media.removeEventListener("change", start);
    };
  }, [labels, mounted]);

  return (
    <div ref={containerRef} className="relative aspect-[4/3] w-full">
      {mounted ? (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        fallback
      )}
    </div>
  );
}
