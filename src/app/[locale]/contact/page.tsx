import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { getLocalizedPath } from "@/config/paths";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { createStaticMarkdownContent } from "@/lib/content/render-static-markdown-content";
import {
  createStaticPageMetadataConfig,
  generateMetadataForPath,
} from "@/lib/seo-metadata";
import type { Locale } from "@/types/content.types";
import {
  ContactFaqSection,
  ContactFormWithFallback,
  ContactInquiryHandoff,
  ContactMethodsCard,
  ResponseExpectationsCard,
} from "@/app/[locale]/contact/contact-page-sections";
import {
  getContactPageData,
  getStaticContactPage,
} from "@/app/[locale]/contact/contact-page-data";

interface ContactPageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export async function generateMetadata({
  params,
}: ContactPageProps): Promise<Metadata> {
  const locale = resolveLocaleParam(await params);
  const page = getStaticContactPage(locale);

  return generateMetadataForPath({
    locale,
    pageType: "contact",
    path: getLocalizedPath("contact", locale),
    config: createStaticPageMetadataConfig(page.metadata),
  });
}

function ContactContentBody({ locale }: { locale: Locale }) {
  const { page, messages, copy, faqItems, faqSectionTitle, faqSchema } =
    getContactPageData(locale);

  return (
    <div
      className="min-h-[80dvh] px-6 py-14 md:py-[72px]"
      data-testid="contact-page-content"
    >
      <JsonLdGraphScript locale={locale} data={faqSchema ? [faqSchema] : []} />
      <div className="mx-auto max-w-[1080px]">
        <header className="mb-10 max-w-2xl min-w-0">
          <h1 className="text-heading mb-4">{page.metadata.title}</h1>
          {page.metadata.description ? (
            <p className="text-body text-muted-foreground">
              {page.metadata.description}
            </p>
          ) : null}
        </header>

        <article className="prose mb-10 max-w-3xl prose-neutral dark:prose-invert">
          {createStaticMarkdownContent(page.content)}
        </article>

        <ContactInquiryHandoff messages={messages} />

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <ContactFormWithFallback messages={messages} />

          <div className="space-y-4" data-testid="contact-confidence-column">
            <ResponseExpectationsCard
              responseCopy={copy.panel.response}
              hoursCopy={copy.panel.hours}
            />
            <ContactMethodsCard copy={copy.panel.contact} />
          </div>
        </div>
      </div>

      {faqItems.length > 0 ? (
        <ContactFaqSection faqItems={faqItems} title={faqSectionTitle} />
      ) : null}
    </div>
  );
}

export default async function ContactPage({ params }: ContactPageProps) {
  const locale = resolveLocaleParam(await params);
  setRequestLocale(locale);

  return <ContactContentBody locale={locale} />;
}
