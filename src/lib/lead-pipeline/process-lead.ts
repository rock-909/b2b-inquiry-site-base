import "server-only";

import { getOfferingById } from "@/config/offerings";
import { airtableService } from "@/lib/airtable/instance";
import { AIRTABLE_REQUEST_TIMEOUT_MS } from "@/lib/airtable/service";
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
import { resendService } from "@/lib/resend-instance";

interface LeadProcessingContext {
  referenceId: string;
}

export interface LeadResult {
  success: boolean;
  emailSent: boolean;
  ownerNotified: boolean;
  recordCreated: boolean;
  referenceId?: string | undefined;
  error?: "PROCESSING_FAILED";
}

const LEAD_DELIVERY_POLICY = "email-first-storage-optional" as const;

// 业主后台的数据，不是网站访客可见文案，不走 i18n 翻译键。
const OWNER_EMAIL_FAILED_NOTICE =
  "⚠️ NOTE: the notification email for this inquiry FAILED to send.\n" +
  "You are seeing this lead only because it was saved here.\n\n";

function normalizeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function withAirtableBudget<T>(operation: Promise<T>): Promise<T> {
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<never>((_resolve, reject) => {
    budgetTimer = setTimeout(() => {
      reject(new Error("AIRTABLE_REQUEST_TIMEOUT"));
    }, AIRTABLE_REQUEST_TIMEOUT_MS);
  });
  return Promise.race([operation, budget]).finally(() => {
    clearTimeout(budgetTimer);
  });
}

function createProcessingFailureResult(referenceId?: string): LeadResult {
  return {
    success: false,
    emailSent: false,
    ownerNotified: false,
    recordCreated: false,
    ...(referenceId ? { referenceId } : {}),
    error: "PROCESSING_FAILED",
  };
}

function createInquiryEmailData(
  lead: InquiryLeadInput,
  referenceId: string,
): InquiryEmailData {
  const { firstName, lastName } = splitName(lead.fullName);
  const offering = getOfferingById(lead.offeringId);
  const requirements = resolveBuyerMessage({ message: lead.message });

  return {
    referenceId,
    firstName,
    lastName,
    email: lead.email,
    ...(lead.interest ? { interest: lead.interest } : {}),
    ...(offering
      ? { offeringId: offering.id, offeringName: offering.name }
      : {}),
    ...(requirements ? { requirements } : {}),
  };
}

async function sendOwnerEmail(
  lead: InquiryLeadInput,
  context: LeadProcessingContext,
): Promise<boolean> {
  try {
    await resendService.sendInquiryEmail(
      createInquiryEmailData(lead, context.referenceId),
    );
    return true;
  } catch (error) {
    logger.error("Owner inquiry email failed", {
      error: normalizeErrorMessage(error),
      email: sanitizeEmail(lead.email),
      referenceId: context.referenceId,
    });
    return false;
  }
}

async function createInquiryLeadRecord(
  lead: InquiryLeadInput,
  context: LeadProcessingContext,
  emailSent: boolean,
): Promise<boolean> {
  const { firstName, lastName } = splitName(lead.fullName);
  const { referenceId } = context;
  const offering = getOfferingById(lead.offeringId);
  const buyerText = resolveBuyerMessage({ message: lead.message });
  const baseMessage = generateInquiryMessage({
    offeringName: offering?.name,
    interest: lead.interest,
    requirements: buyerText,
  });
  // 邮件没发出去时，业主唯一能看到这条线索的地方就是这条记录。
  // 提示写进自由文本的 Message 字段：写什么都不会被 Airtable 拒收，
  // 换成 Status 单选列的话，选项不存在会让整条记录被拒，反而丢线索。
  const message = emailSent
    ? baseMessage
    : `${OWNER_EMAIL_FAILED_NOTICE}${baseMessage}`;

  try {
    await withAirtableBudget(
      airtableService.createLead({
        firstName,
        lastName,
        email: lead.email,
        message,
        ...(lead.interest ? { interest: lead.interest } : {}),
        ...(offering
          ? { offeringId: offering.id, offeringName: offering.name }
          : {}),
        ...(buyerText ? { requirements: buyerText } : {}),
        referenceId,
        ...pickAttributionFields(lead),
      }),
    );
    return true;
  } catch (error) {
    logger.error("Inquiry Airtable createLead failed (non-blocking)", {
      error: normalizeErrorMessage(error),
      email: sanitizeEmail(lead.email),
      leadDeliveryPolicy: LEAD_DELIVERY_POLICY,
      referenceId,
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

    // 串行不是为了代码顺一点：邮件结果必须在记录创建之前拿到，才能把
    // 「这封通知没发出去」一次写进记录。事后补一次更新做不到——Airtable
    // 限流重试可能在预算过期后才落库，那时已经拿不到记录编号了。
    // 代价：最坏耗时从 max(5s, 8s) 变成 5s + 8s。邮件有 5 秒硬超时，不会无限等。
    const emailSent = await sendOwnerEmail(input, { referenceId });
    const recordCreated = await createInquiryLeadRecord(
      input,
      { referenceId },
      emailSent,
    );

    if (!emailSent && !recordCreated) {
      return createProcessingFailureResult(referenceId);
    }

    return {
      success: true,
      emailSent,
      ownerNotified: emailSent,
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
