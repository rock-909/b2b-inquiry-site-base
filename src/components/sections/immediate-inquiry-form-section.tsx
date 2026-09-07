import { createInquiryFormCopyFromMessages } from "@/components/forms/inquiry-form-copy";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import { InquiryFormSectionShell } from "@/components/sections/inquiry-form-section-shell";
import { SINGLE_SITE_FACTS } from "@/config/single-site";

export function ImmediateInquiryFormSection({
  id,
  title,
  description,
  initialMessage,
  messages,
}: {
  id?: string;
  title: string;
  description?: string;
  initialMessage?: string;
  messages: Record<string, unknown>;
}) {
  const inquiryCopy = createInquiryFormCopyFromMessages(
    messages,
    SINGLE_SITE_FACTS.contact.email,
  );
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
