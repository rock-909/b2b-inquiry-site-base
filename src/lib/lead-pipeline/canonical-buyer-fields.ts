/**
 * Canonical public inquiry buyer fields for /api/inquiry and downstream
 * owner email and Airtable delivery.
 */

import { z } from "zod";
import {
  MAX_LEAD_EMAIL_LENGTH,
  MAX_LEAD_MESSAGE_LENGTH,
  MAX_LEAD_NAME_LENGTH,
} from "@/constants/validation-limits";
import { hasSpreadsheetFormulaPrefix } from "@/lib/security/spreadsheet-formula";
import {
  sanitizeMultilineText,
  sanitizePlainText,
} from "@/lib/security/validation";

const sanitizedString = () => z.string().overwrite(sanitizePlainText);

function normalizeOptionalInput(value: unknown): unknown {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === "string" && value.trim().length === 0) {
    return undefined;
  }
  return typeof value === "string" ? value.trim() : value;
}

export const canonicalBuyerFullNameSchema = sanitizedString()
  .min(1)
  .max(MAX_LEAD_NAME_LENGTH);

export const canonicalBuyerEmailSchema = z
  .email()
  .trim()
  .min(1)
  .max(MAX_LEAD_EMAIL_LENGTH)
  .refine((email) => !hasSpreadsheetFormulaPrefix(email));

export const canonicalBuyerMessageSchema: z.ZodType<string | undefined> = z
  .unknown()
  .transform(normalizeOptionalInput)
  .pipe(
    z.union([
      z.undefined(),
      z.string().overwrite(sanitizeMultilineText).max(MAX_LEAD_MESSAGE_LENGTH),
    ]),
  );
