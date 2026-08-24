/**
 * Resend邮件服务核心类
 * Resend email service core class
 */

import "server-only";

import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { EMAIL_COPY } from "@/emails/email-copy";
import { env, getRuntimeEnvString } from "@/lib/env";
import {
  inquiryEmailDataSchema,
  type InquiryEmailData,
} from "@/lib/email/email-data-schema";
import { ResendHttpEmailClient } from "@/lib/email/resend-http-client";
import { buildInquiryEmailContent } from "@/lib/email/runtime-email-content";
import { logger, sanitizeEmail } from "@/lib/logger";
import {
  sanitizeMultilineText,
  sanitizePlainText,
} from "@/lib/security/validation";

function sanitizeInquiryData(data: InquiryEmailData): InquiryEmailData {
  return {
    referenceId: data.referenceId,
    firstName: sanitizePlainText(data.firstName),
    lastName: sanitizePlainText(data.lastName),
    email: data.email.toLowerCase().trim(),
    requirements: data.requirements
      ? sanitizeMultilineText(data.requirements)
      : undefined,
  };
}

function getInquiryTags(referenceId: string) {
  return [
    { name: "type", value: "inquiry" },
    { name: "source", value: "website" },
    { name: "reference-id", value: referenceId },
  ];
}

export class ResendService {
  private resend: ResendHttpEmailClient | null = null;
  private isConfigured: boolean = false;
  private emailConfig: {
    from: string;
    recipient: string;
  };

  constructor() {
    this.emailConfig = this.readEmailConfig();
  }

  private readEmailEnv(
    key: "EMAIL_FROM" | "INQUIRY_RECIPIENT_EMAIL",
  ): string | undefined {
    return getRuntimeEnvString(key) ?? env[key];
  }

  private readEmailConfig(): typeof this.emailConfig {
    const recipient = this.readEmailEnv("INQUIRY_RECIPIENT_EMAIL");
    return {
      from: this.readEmailEnv("EMAIL_FROM") || SINGLE_SITE_CONFIG.contact.email,
      recipient: recipient || SINGLE_SITE_CONFIG.contact.email,
    };
  }

  private initializeResend(): void {
    try {
      if (this.isConfigured && this.resend !== null) {
        return;
      }

      const apiKey =
        getRuntimeEnvString("RESEND_API_KEY") ?? env.RESEND_API_KEY;
      this.emailConfig = this.readEmailConfig();

      if (!apiKey) {
        logger.warn("Resend API key missing - email service will be disabled");
        return;
      }

      this.resend = new ResendHttpEmailClient(apiKey);
      this.isConfigured = true;

      logger.info("Resend email service initialized successfully", {
        from: this.emailConfig.from,
        recipient: this.emailConfig.recipient,
      });
    } catch (error) {
      logger.error("Failed to initialize Resend service", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  public isReady(): boolean {
    if (!this.isConfigured || this.resend === null) {
      this.initializeResend();
    }
    return this.isConfigured && this.resend !== null;
  }

  public async sendInquiryEmail(data: InquiryEmailData): Promise<string> {
    if (!this.isReady()) {
      throw new Error("Resend service is not configured");
    }

    try {
      const validatedData = inquiryEmailDataSchema.parse(data);
      const sanitizedData = sanitizeInquiryData(validatedData);

      const emailContent = buildInquiryEmailContent(sanitizedData);

      const result = await this.resend!.send({
        from: this.emailConfig.from,
        to: [this.emailConfig.recipient],
        replyTo: sanitizedData.email,
        subject: EMAIL_COPY.inquiry.subject(sanitizedData),
        html: emailContent.html,
        text: emailContent.text,
        tags: getInquiryTags(sanitizedData.referenceId),
      });

      if (result.error || !result.data) {
        throw new Error(
          `Resend API error: ${result.error?.message ?? "missing message id"}`,
        );
      }

      logger.info("Inquiry email sent successfully", {
        referenceId: sanitizedData.referenceId,
        messageId: result.data.id,
        to: sanitizeEmail(this.emailConfig.recipient),
        from: sanitizeEmail(sanitizedData.email),
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
}
