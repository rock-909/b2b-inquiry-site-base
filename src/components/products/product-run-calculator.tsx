"use client";

import { useId, useState } from "react";
import type { TucsenbergProductCalculator } from "@/constants/tucsenberg-product-page-types";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { createCatalogInquiryHref } from "@/lib/lead-pipeline/inquiry-handoff";

/**
 * Straight-run unit estimator wired as a quote funnel: it outputs quantities
 * only (never prices) and its CTA carries the configuration into the RFQ
 * message. Design rule: docs/design/设计真相.md.
 *
 * Without JS the inputs stay inert but the honest note and the plain
 * request-a-quote CTA below remain a working static entry.
 */

const CM_PER_M = 100;

const CALCULATOR_INPUT_CLASS =
  "min-h-11 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-[var(--shadow-xs)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type LengthUnit = "m" | "cm";

export function ProductRunCalculator({
  calculator,
}: {
  calculator: TucsenbergProductCalculator;
}) {
  const inputId = useId();
  const [length, setLength] = useState("");
  const [unit, setUnit] = useState<LengthUnit>("m");

  const parsed = Number.parseFloat(length);
  const lengthCm =
    Number.isFinite(parsed) && parsed > 0
      ? unit === "m"
        ? parsed * CM_PER_M
        : parsed
      : 0;
  const units = lengthCm > 0 ? Math.ceil(lengthCm / calculator.unitWidthCm) : 0;

  const lengthLabel = `${length} ${unit}`;
  const quoteHref =
    units > 0
      ? createCatalogInquiryHref(
          calculator.catalogProductId,
          calculator.rfqMessageTemplate
            .replace("{length}", lengthLabel)
            .replace("{units}", String(units)),
        )
      : createCatalogInquiryHref(calculator.catalogProductId);

  return (
    <section className="surface-card p-6 md:p-8">
      <h2 className="mb-4 text-2xl font-semibold">{calculator.heading}</h2>
      <p className="mb-6 max-w-2xl text-base leading-7 text-muted-foreground">
        {calculator.intro}
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <label
            className="block text-sm leading-none font-medium text-foreground"
            htmlFor={inputId}
          >
            {calculator.inputLabel}
          </label>
          <input
            className={`${CALCULATOR_INPUT_CLASS} w-36`}
            id={inputId}
            inputMode="decimal"
            min={0}
            onChange={(event) => setLength(event.target.value)}
            step="0.5"
            type="number"
            value={length}
          />
        </div>
        <select
          aria-label={calculator.unitSelectLabel}
          className={CALCULATOR_INPUT_CLASS}
          onChange={(event) => setUnit(event.target.value as LengthUnit)}
          value={unit}
        >
          <option value="m">m</option>
          <option value="cm">cm</option>
        </select>
      </div>

      <p
        aria-live="polite"
        className="mt-4 min-h-7 font-mono text-lg font-semibold text-foreground tabular-nums"
      >
        {units > 0 ? `≈ ${units} ${calculator.resultUnitLabel}` : ""}
      </p>

      <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
        {calculator.disclaimer}
      </p>

      <div className="mt-6">
        <Button asChild>
          <Link href={quoteHref}>{calculator.ctaLabel}</Link>
        </Button>
      </div>
    </section>
  );
}
