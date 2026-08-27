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

// 业主后台的数据，不是网站访客可见文案，不走 i18n 翻译键。
const OWNER_EMAIL_FAILED_NOTICE =
  "⚠️ NOTE: the notification email for this inquiry FAILED to send.\n" +
  "You are seeing this lead only because it was saved here.\n\n";

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

async function createInquiryLeadRecord(
  lead: OwnerLead,
  emailSent: boolean,
): Promise<boolean> {
  const baseMessage = generateInquiryMessage({
    requirements: lead.requirements,
  });
  // 邮件没发出去时，业主唯一能看到这条线索的地方就是这条记录。
  // 提示写进自由文本的 Message 字段：写什么都不会被 Airtable 拒收，
  // 换成 Status 单选列的话，选项不存在会让整条记录被拒，反而丢线索。
  const message = emailSent
    ? baseMessage
    : `${OWNER_EMAIL_FAILED_NOTICE}${baseMessage}`;

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

    // 邮件结果必须先落定，记录才能准确写入通知失败提示。
    // 代价：最坏耗时是邮件预算加 Airtable 的 8 秒中止预算。
    const ownerLead = createOwnerLead(input, referenceId);
    const emailSent = await sendOwnerEmail(ownerLead);
    const recordCreated = await createInquiryLeadRecord(ownerLead, emailSent);

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
