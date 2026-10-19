/**
 * Resend 询盘邮件投递
 * Resend inquiry email delivery
 */

import "server-only";

import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { EMAIL_COPY } from "@/emails/email-copy";
import { getRuntimeEnvString } from "@/lib/env";
import { ResendHttpEmailClient } from "@/lib/email/resend-http-client";
import { buildInquiryEmailContent } from "@/lib/email/runtime-email-content";
import type { ValidatedInquiry } from "@/lib/lead-pipeline/lead-schema";
import { logger, sanitizeEmail } from "@/lib/logger";

function getInquiryTags(referenceId: string) {
  return [
    { name: "type", value: "inquiry" },
    { name: "source", value: "website" },
    { name: "reference-id", value: referenceId },
  ];
}

/**
 * 每次调用都读取运行时配置（与 createAirtableLead 同形）：Worker secret 只在
 * 请求期可取，不能在模块加载时绑定真实 client。
 */
export async function sendInquiryEmail(
  data: ValidatedInquiry,
): Promise<string> {
  const apiKey = getRuntimeEnvString("RESEND_API_KEY");

  if (!apiKey) {
    logger.warn("Resend API key missing - email service will be disabled");
    throw new Error("Resend service is not configured");
  }

  const from =
    getRuntimeEnvString("EMAIL_FROM") || SINGLE_SITE_CONFIG.contact.email;
  const recipient =
    getRuntimeEnvString("INQUIRY_RECIPIENT_EMAIL") ||
    SINGLE_SITE_CONFIG.contact.email;

  try {
    const emailContent = buildInquiryEmailContent(data);

    const result = await new ResendHttpEmailClient(apiKey).send({
      from,
      to: [recipient],
      replyTo: data.email,
      subject: EMAIL_COPY.inquiry.subject(data),
      html: emailContent.html,
      text: emailContent.text,
      tags: getInquiryTags(data.referenceId),
    });

    if (result.error || !result.data) {
      throw new Error(
        `Resend API error: ${result.error?.message ?? "missing message id"}`,
      );
    }

    logger.info("Inquiry email sent successfully", {
      referenceId: data.referenceId,
      messageId: result.data.id,
      to: sanitizeEmail(recipient),
      from: sanitizeEmail(data.email),
    });

    return result.data.id;
  } catch (error) {
    logger.error("Failed to send inquiry email", {
      referenceId: data.referenceId,
      error: error instanceof Error ? error.message : "Unknown error",
      email: sanitizeEmail(data.email),
    });
    throw new Error("Failed to send inquiry email", { cause: error });
  }
}
