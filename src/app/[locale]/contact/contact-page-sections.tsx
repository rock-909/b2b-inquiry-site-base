import { getTranslations } from "next-intl/server";
import {
  getPublicContactEmail,
  getPublicContactPhone,
} from "@/config/public-trust";
import { SINGLE_SITE_FACTS } from "@/config/single-site";
import type { Locale } from "@/types/content.types";
import { createInquiryFormCopy } from "@/components/forms/inquiry-form-copy";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";

export async function ContactMethodsCard({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.panel" });
  const email = getPublicContactEmail(SINGLE_SITE_FACTS.contact.email);
  const phone = getPublicContactPhone(SINGLE_SITE_FACTS.contact.phone);
  return (
    <section className="space-y-3 text-sm">
      <h2 className="font-semibold">{t("contactTitle")}</h2>
      {email ? (
        <a
          className="block w-fit py-2 break-all underline underline-offset-4"
          href={`mailto:${email}`}
        >
          {email}
        </a>
      ) : (
        <p className="text-muted-foreground">{t("emailUnavailable")}</p>
      )}
      {phone ? (
        <a
          className="block w-fit py-2 break-words underline underline-offset-4"
          href={`tel:${phone}`}
        >
          {phone}
        </a>
      ) : null}
    </section>
  );
}

export async function ContactFormWithFallback({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "inquiry.form" });
  const inquiryCopy = createInquiryFormCopy(t, getPublicContactEmail());
  const inquiryFallback = <InquiryFormStaticFallback copy={inquiryCopy} />;

  return (
    <div
      id="inquiry"
      className="min-w-0 scroll-mt-24 space-y-6"
      data-testid="contact-form-column"
    >
      <InquiryForm copy={inquiryCopy} fallback={inquiryFallback} />
    </div>
  );
}
