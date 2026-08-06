/**
 * Lead Pipeline Utility Functions
 */

import { randomBytes } from "crypto";

export interface SplitNameResult {
  firstName: string;
  lastName: string;
}

export function splitName(fullName: string): SplitNameResult {
  const normalizedName = fullName.trim();
  const parts = normalizedName.split(/\s+/);

  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: "" };
  }

  const lastName = parts.pop()!;
  return { firstName: parts.join(" "), lastName };
}

export interface InquiryMessageParts {
  offeringName?: string | undefined;
  interest?: string | undefined;
  requirements?: string | undefined;
}

export function generateInquiryMessage(parts: InquiryMessageParts): string {
  const lines: string[] = [];

  if (parts.offeringName?.trim()) {
    lines.push(`Offering: ${parts.offeringName.trim()}`);
  }

  if (parts.interest?.trim()) {
    lines.push(`Interest: ${parts.interest.trim()}`);
  }

  if (parts.requirements?.trim()) {
    lines.push(`Requirements: ${parts.requirements.trim()}`);
  }

  return lines.length > 0 ? lines.join("\n") : "General inquiry";
}

export function resolveBuyerMessage(parts: {
  message?: string | undefined;
}): string | undefined {
  const message = parts.message?.trim();
  return message ? message : undefined;
}

export function generateLeadReferenceId(type: string): string {
  const timestamp = Date.now().toString(36);
  const random = randomBytes(4).toString("hex");
  const prefix = type.substring(0, 3).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}
