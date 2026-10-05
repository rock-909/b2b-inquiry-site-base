import "server-only";

import { createAirtableLead } from "@/lib/airtable/service";
import {
  INQUIRY_LEAD_TYPE,
  type InquiryLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import { generateLeadReferenceId, splitName } from "@/lib/lead-pipeline/utils";
import { logger, sanitizeEmail } from "@/lib/logger";
import {
  type MarketingAttributionFields,
  pickAttributionFields,
} from "@/lib/marketing/attribution-fields";
import { ResendService } from "@/lib/resend-core";

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
const resendService = new ResendService();

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

function createOwnerLead(lead: InquiryLeadInput, referenceId: string) {
  const { firstName, lastName } = splitName(lead.fullName);

  return {
    referenceId,
    firstName,
    lastName,
    email: lead.email,
    ...(lead.message ? { message: lead.message } : {}),
  };
}

type OwnerLead = ReturnType<typeof createOwnerLead>;

async function sendOwnerEmail(lead: OwnerLead): Promise<boolean> {
  try {
    await resendService.sendInquiryEmail(lead);
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
  lead: OwnerLead,
  attribution: MarketingAttributionFields,
): Promise<boolean> {
  try {
    await createAirtableLead({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      // Airtable 的 Message 列带 "Requirements: " 前缀，Requirements 列存原文；
      // 两列都是业主可见契约，值都来自买家留言。
      message: lead.message
        ? `Requirements: ${lead.message}`
        : "General inquiry",
      ...(lead.message ? { requirements: lead.message } : {}),
      referenceId: lead.referenceId,
      ...attribution,
    });
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

    const ownerLead = createOwnerLead(input, referenceId);
    // 两个独立收件通道共享引用号，不让邮件故障阻塞备份写入。
    const [emailSent, recordCreated] = await Promise.all([
      sendOwnerEmail(ownerLead),
      createInquiryLeadRecord(ownerLead, pickAttributionFields(input)),
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
