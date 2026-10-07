import { getTranslations } from "next-intl/server";
import { createInquiryFormCopy } from "@/components/forms/inquiry-form-copy";
import { DeferredInquiryForm } from "@/components/forms/deferred-inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import { InquiryFormSectionShell } from "@/components/sections/inquiry-form-section-shell";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import type { Locale } from "@/types/content.types";

/**
 * 首页首屏下方的询盘区块。该模块不得静态引入 InquiryForm，否则
 * Turbopack 会把完整表单重新加入首页首载 client graph。
 */
export async function EmbeddedInquiryFormSection({
  title,
  description,
  locale,
}: {
  title: string;
  description?: string;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "inquiry.form" });
  const inquiryCopy = createInquiryFormCopy(t, SINGLE_SITE_FACTS.contact.email);
  const inquiryFallback = <InquiryFormStaticFallback copy={inquiryCopy} />;

  return (
    <InquiryFormSectionShell
      title={title}
      {...(description ? { description } : {})}
    >
      <DeferredInquiryForm copy={inquiryCopy} fallback={inquiryFallback} />
    </InquiryFormSectionShell>
  );
}
