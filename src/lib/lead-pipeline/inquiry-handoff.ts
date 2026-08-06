import { getOfferingById } from "@/config/offerings";
import {
  MAX_INQUIRY_CONFIG_PREFILL_LENGTH,
  MAX_LEAD_INTEREST_LENGTH,
} from "@/constants/validation-limits";

function capBuyerInterest(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.slice(0, MAX_LEAD_INTEREST_LENGTH);
}

function capConfigPrefill(raw: string | null | undefined): string | undefined {
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  return trimmed.slice(0, MAX_INQUIRY_CONFIG_PREFILL_LENGTH);
}

export type InquirySearchParams = Record<string, string | string[] | undefined>;

export type ValidatedInquiryContext =
  | {
      kind: "offering-context";
      offeringId: string;
      displayLabel: string;
      interest?: string;
      initialMessage?: string;
    }
  | {
      kind: "general-context";
      interest?: string;
      initialMessage?: string;
    };

function readOptionalDescription(
  searchParams: InquirySearchParams,
  key: "interest" | "config",
): string | undefined {
  const value = searchParams[key];
  const raw = Array.isArray(value) ? value[0] : value;
  return key === "interest"
    ? capBuyerInterest(raw ?? null)
    : capConfigPrefill(raw ?? null);
}

function readOfferingId(searchParams: InquirySearchParams): string | undefined {
  const value = searchParams.offeringId;
  if (Array.isArray(value) || typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function resolveInquiryContext(
  searchParams: InquirySearchParams,
): ValidatedInquiryContext {
  const interest = readOptionalDescription(searchParams, "interest");
  const initialMessage = readOptionalDescription(searchParams, "config");
  const descriptionFields = {
    ...(interest ? { interest } : {}),
    ...(initialMessage ? { initialMessage } : {}),
  };

  const offeringId = readOfferingId(searchParams);
  const offering = getOfferingById(offeringId);
  if (!offering) {
    return {
      kind: "general-context",
      ...descriptionFields,
    };
  }

  return {
    kind: "offering-context",
    offeringId: offering.id,
    displayLabel: offering.name,
    ...descriptionFields,
  };
}
