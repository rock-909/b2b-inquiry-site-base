import "server-only";

import { createAirtableLead } from "@/lib/airtable/service";
import {
  INQUIRY_LEAD_TYPE,
  type InquiryLeadInput,
  type ValidatedInquiry,
} from "@/lib/lead-pipeline/lead-schema";
import { generateLeadReferenceId } from "@/lib/lead-pipeline/utils";
import { logger, sanitizeEmail } from "@/lib/logger";
import { sendInquiryEmail } from "@/lib/resend-core";

export type LeadResult =
  | {
      success: true;
      emailSent: boolean;
      recordCreated: boolean;
      referenceId: string;
    }
  | {
      success: false;
      emailSent: boolean;
      recordCreated: boolean;
      referenceId?: string | undefined;
      error: "PROCESSING_FAILED";
    };

const LEAD_DELIVERY_POLICY = "email-primary-airtable-backup" as const;

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function createProcessingFailureResult(referenceId?: string): LeadResult {
  return {
    success: false,
    emailSent: false,
    recordCreated: false,
    ...(referenceId ? { referenceId } : {}),
    error: "PROCESSING_FAILED",
  };
}

async function sendOwnerEmail(lead: ValidatedInquiry): Promise<boolean> {
  try {
    await sendInquiryEmail(lead);
    return true;
  } catch (error) {
    logger.error("Owner inquiry email failed", {
      error: normalizeErrorMessage(error),
      email: sanitizeEmail(lead.email),
      referenceId: lead.referenceId,
    });
    return false;
  }
}

async function createInquiryLeadRecord(
  lead: ValidatedInquiry,
): Promise<boolean> {
  try {
    await createAirtableLead(lead);
    return true;
  } catch (error) {
    logger.error("Inquiry Airtable backup failed", {
      error: normalizeErrorMessage(error),
      email: sanitizeEmail(lead.email),
      leadDeliveryPolicy: LEAD_DELIVERY_POLICY,
      referenceId: lead.referenceId,
    });
    return false;
  }
}

export async function processValidatedInquiry(
  input: InquiryLeadInput,
): Promise<LeadResult> {
  let referenceId: string | undefined;

  try {
    referenceId = generateLeadReferenceId();

    logger.info("Processing lead", {
      type: INQUIRY_LEAD_TYPE,
      email: sanitizeEmail(input.email),
      leadDeliveryPolicy: LEAD_DELIVERY_POLICY,
      referenceId,
    });

    const lead: ValidatedInquiry = { ...input, referenceId };
    // 两个独立收件通道共享引用号，不让邮件故障阻塞备份写入。
    const [emailSent, recordCreated] = await Promise.all([
      sendOwnerEmail(lead),
      createInquiryLeadRecord(lead),
    ]);

    if (!emailSent && !recordCreated) {
      return createProcessingFailureResult(referenceId);
    }

    return {
      success: true,
      emailSent,
      recordCreated,
      referenceId,
    };
  } catch (error) {
    logger.error("Lead processing unexpected error", {
      type: INQUIRY_LEAD_TYPE,
      referenceId,
      error: normalizeErrorMessage(error),
    });
    return createProcessingFailureResult(referenceId);
  }
}
