import { getTranslations } from "next-intl/server";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import type { Locale } from "@/types/content.types";
import { createInquiryFormCopy } from "@/components/forms/inquiry-form-copy";
import { InquiryForm } from "@/components/forms/inquiry-form";
import { InquiryFormStaticFallback } from "@/components/forms/inquiry-form-static-fallback";
import { Link } from "@/i18n/routing";
import { formatCompanyAddress, whatsappHref } from "@/lib/site-contact";

export async function ContactMethodsCard({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "contact.panel" });
  const { email, phone, whatsapp } = SINGLE_SITE_CONFIG.contact;
  const address = formatCompanyAddress(SINGLE_SITE_CONFIG.company?.location);
  if (!email && !phone && !whatsapp && !address) return null;
  return (
    <section className="space-y-3 text-sm">
      <h2 className="font-semibold">{t("contactTitle")}</h2>
      {email ? (
        <a
          className="text-link block w-fit py-2 break-all"
          href={`mailto:${email}`}
        >
          {email}
        </a>
      ) : null}
      {phone ? (
        <a
          className="text-link block w-fit py-2 break-words"
          href={`tel:${phone}`}
        >
          {phone}
        </a>
      ) : null}
      {whatsapp ? (
        <a
          className="text-link block w-fit py-2 break-words"
          href={whatsappHref(whatsapp)}
        >
          WhatsApp {whatsapp}
        </a>
      ) : null}
      {address ? (
        <address className="py-2 not-italic">{address}</address>
      ) : null}
    </section>
  );
}

export async function ContactFormWithFallback({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: "inquiry.form" });
  const inquiryCopy = createInquiryFormCopy(
    t,
    SINGLE_SITE_CONFIG.contact.email || undefined,
    t.rich("privacyNotice", {
      privacy: (chunks) => (
        <Link className="text-link" href="/privacy" prefetch={false}>
          {chunks}
        </Link>
      ),
      terms: (chunks) => (
        <Link className="text-link" href="/terms" prefetch={false}>
          {chunks}
        </Link>
      ),
    }),
  );
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
