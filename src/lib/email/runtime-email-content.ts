import { EMAIL_COPY } from "@/emails/email-copy";
import {
  COLORS,
  FONT_FAMILY,
  FONT_SIZES,
  SIZES,
  SPACING,
} from "@/emails/theme";
import type { ProductInquiryEmailData } from "@/lib/email/email-data-schema";

export interface RuntimeEmailContent {
  html: string;
  text: string;
}

interface EmailFieldContent {
  label: string;
  value: string;
  multiline?: boolean;
}

interface EmailDocumentOptions {
  title: string;
  preview: string;
  accentColor: string;
  footerText: string;
  contentBackgroundColor: string;
  bodyHtml: string;
  bodyText: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function compactFields(
  fields: Array<EmailFieldContent | null | undefined>,
): EmailFieldContent[] {
  return fields.filter((field): field is EmailFieldContent => Boolean(field));
}

function renderField({ label, value, multiline }: EmailFieldContent): string {
  const valueHtml = multiline
    ? value
        .split(/\r?\n/u)
        .map(
          (line) =>
            `<p style="margin:0 0 6px 0;line-height:1.5;">${escapeHtml(
              line || " ",
            )}</p>`,
        )
        .join("")
    : `<p style="margin:0;line-height:1.5;">${escapeHtml(value)}</p>`;

  return [
    `<section style="margin-bottom:${SPACING.md};">`,
    `<p style="font-weight:bold;color:${COLORS.textLight};margin:0 0 5px 0;">${escapeHtml(label)}</p>`,
    `<section style="margin:0;padding:${SPACING.sm};background-color:${COLORS.background};border-radius:${SIZES.borderRadius};">`,
    valueHtml,
    "</section>",
    "</section>",
  ].join("");
}

function renderFields(fields: readonly EmailFieldContent[]): string {
  return fields.map((field) => renderField(field)).join("");
}

function renderPlainFields(fields: readonly EmailFieldContent[]): string {
  return fields.map((field) => `${field.label}: ${field.value}`).join("\n");
}

function renderEmailDocument({
  title,
  preview,
  accentColor,
  footerText,
  contentBackgroundColor,
  bodyHtml,
  bodyText,
}: EmailDocumentOptions): RuntimeEmailContent {
  const html = [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    `<title>${escapeHtml(title)}</title>`,
    "</head>",
    `<body style="font-family:${FONT_FAMILY};line-height:1.6;color:${COLORS.text};background-color:${COLORS.background};margin:0;padding:0;">`,
    `<div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>`,
    `<main style="max-width:${SIZES.maxWidth};margin:0 auto;padding:${SPACING.lg};">`,
    `<section style="padding:${SPACING.lg};text-align:center;color:${COLORS.headerText};border-radius:${SIZES.borderRadius} ${SIZES.borderRadius} 0 0;background-color:${accentColor};">`,
    `<h1 style="margin:0;font-size:${FONT_SIZES.xl};">${escapeHtml(title)}</h1>`,
    "</section>",
    `<section style="padding:${SPACING.lg};background-color:${contentBackgroundColor};border-radius:0 0 ${SIZES.borderRadius} ${SIZES.borderRadius};">`,
    bodyHtml,
    "</section>",
    `<footer style="padding:${SPACING.lg};text-align:center;">`,
    `<p style="margin:0;font-size:${FONT_SIZES.xs};color:${COLORS.muted};">${escapeHtml(footerText)}</p>`,
    "</footer>",
    "</main>",
    "</body>",
    "</html>",
  ].join("");

  return {
    html,
    text: [title, "", preview, "", bodyText, "", footerText].join("\n"),
  };
}

export function buildProductInquiryEmailContent(
  data: ProductInquiryEmailData,
): RuntimeEmailContent {
  const fields = compactFields([
    { label: EMAIL_COPY.common.fields.product, value: data.productName },
    { label: EMAIL_COPY.common.fields.reference, value: data.referenceId },
    {
      label: EMAIL_COPY.common.fields.contactName,
      value: `${data.firstName} ${data.lastName}`,
    },
    { label: EMAIL_COPY.common.fields.email, value: data.email },
    data.requirements
      ? {
          label: EMAIL_COPY.common.fields.requirements,
          value: data.requirements,
          multiline: true,
        }
      : null,
  ]);
  const highlightHtml = [
    `<section style="background-color:${COLORS.successLight};border-left:4px solid ${COLORS.success};padding:${SPACING.md};margin-bottom:${SPACING.lg};">`,
    `<p style="margin:0 0 6px 0;font-weight:bold;color:${COLORS.textLight};font-size:${FONT_SIZES.sm};">${escapeHtml(
      EMAIL_COPY.common.fields.product,
    )}</p>`,
    `<p style="margin:0 0 10px 0;font-size:${FONT_SIZES.lg};font-weight:bold;">${escapeHtml(
      data.productName,
    )}</p>`,
    "</section>",
  ].join("");
  const bodyFields = fields.filter(
    (field) => field.label !== EMAIL_COPY.common.fields.product,
  );

  return renderEmailDocument({
    title: EMAIL_COPY.productInquiry.title,
    preview: EMAIL_COPY.productInquiry.preview,
    accentColor: COLORS.success,
    footerText: EMAIL_COPY.productInquiry.footer(),
    contentBackgroundColor: COLORS.contentBackground,
    bodyHtml: `${highlightHtml}${renderFields(bodyFields)}`,
    bodyText: renderPlainFields(fields),
  });
}
