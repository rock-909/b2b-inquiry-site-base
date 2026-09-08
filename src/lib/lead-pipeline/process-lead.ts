import "server-only";

import { createAirtableLead } from "@/lib/airtable/service";
import type { InquiryEmailData } from "@/lib/email/email-data-schema";
import {
  INQUIRY_LEAD_TYPE,
  type InquiryLeadInput,
} from "@/lib/lead-pipeline/lead-schema";
import {
  generateLeadReferenceId,
  generateInquiryMessage,
  resolveBuyerMessage,
  splitName,
} from "@/lib/lead-pipeline/utils";
import { logger, sanitizeEmail } from "@/lib/logger";
import { pickAttributionFields } from "@/lib/marketing/attribution-fields";
import { ResendService } from "@/lib/resend-core";

export interface LeadResult {
  success: boolean;
  emailSent: boolean;
  recordCreated: boolean;
  referenceId?: string | undefined;
  error?: "PROCESSING_FAILED";
}

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
  const requirements = resolveBuyerMessage({ message: lead.message });

  return {
    referenceId,
    firstName,
    lastName,
    email: lead.email,
    ...(requirements ? { requirements } : {}),
    attribution: pickAttributionFields(lead),
  };
}

type OwnerLead = ReturnType<typeof createOwnerLead>;

function createInquiryEmailData(lead: OwnerLead): InquiryEmailData {
  return {
    referenceId: lead.referenceId,
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    ...(lead.requirements ? { requirements: lead.requirements } : {}),
  };
}

async function sendOwnerEmail(lead: OwnerLead): Promise<boolean> {
  try {
    await resendService.sendInquiryEmail(createInquiryEmailData(lead));
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

async function createInquiryLeadRecord(lead: OwnerLead): Promise<boolean> {
  const message = generateInquiryMessage({ requirements: lead.requirements });

  try {
    await createAirtableLead({
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      message,
      ...(lead.requirements ? { requirements: lead.requirements } : {}),
      referenceId: lead.referenceId,
      ...lead.attribution,
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
    referenceId = generateLeadReferenceId(INQUIRY_LEAD_TYPE);

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
      createInquiryLeadRecord(ownerLead),
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
