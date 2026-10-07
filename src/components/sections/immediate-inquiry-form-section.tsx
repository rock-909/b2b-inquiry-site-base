import { getTranslations } from "next-intl/server";
import { createInquiryFormCopy } from "@/components/forms/inquiry-form-copy";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import { InquiryFormSectionShell } from "@/components/sections/inquiry-form-section-shell";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import type { Locale } from "@/types/content.types";

export async function ImmediateInquiryFormSection({
  id,
  title,
  description,
  initialMessage,
  locale,
}: {
  id?: string;
  title: string;
  description?: string;
  initialMessage?: string;
  locale: Locale;
}) {
  const t = await getTranslations({ locale, namespace: "inquiry.form" });
  const inquiryCopy = createInquiryFormCopy(t, SINGLE_SITE_FACTS.contact.email);
  const inquiryFallback = <InquiryFormStaticFallback copy={inquiryCopy} />;

  return (
    <InquiryFormSectionShell
      title={title}
      {...(id ? { id } : {})}
      {...(description ? { description } : {})}
    >
      <InquiryForm
        copy={inquiryCopy}
        fallback={inquiryFallback}
        {...(initialMessage ? { initialMessage } : {})}
      />
    </InquiryFormSectionShell>
  );
}
