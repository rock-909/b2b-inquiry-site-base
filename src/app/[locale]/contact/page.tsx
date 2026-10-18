import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import { JsonLdGraphScript } from "@/components/seo/json-ld-script";
import { getCanonicalPath } from "@/config/paths";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { createStaticMarkdownContent } from "@/lib/content/render-static-markdown-content";
import {
  createStaticPageMetadataConfig,
  generateMetadataForPath,
} from "@/lib/seo-metadata";
import type { Locale } from "@/types/content.types";
import {
  ContactFormWithFallback,
  ContactMethodsCard,
} from "@/app/[locale]/contact/contact-page-sections";
import { getStaticContactPage } from "@/app/[locale]/contact/contact-page-data";

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
    path: getCanonicalPath("contact"),
    config: createStaticPageMetadataConfig(page.metadata),
  });
}

function ContactContentBody({ locale }: { locale: Locale }) {
  const page = getStaticContactPage(locale);

  return (
    <div className="px-6 py-10 md:py-12" data-testid="contact-page-content">
      <JsonLdGraphScript locale={locale} />
      <div className="mx-auto max-w-[720px]">
        <header className="mb-6 max-w-2xl min-w-0">
          <h1 className="text-heading mb-4">{page.metadata.title}</h1>
          {page.metadata.description ? (
            <p className="text-body text-muted-foreground">
              {page.metadata.description}
            </p>
          ) : null}
        </header>

        <article className="prose mb-6 max-w-3xl prose-neutral dark:prose-invert">
          {createStaticMarkdownContent(page.content)}
        </article>

        <div className="min-w-0 space-y-8">
          <ContactFormWithFallback locale={locale} />
          <ContactMethodsCard locale={locale} />
        </div>
      </div>
    </div>
  );
}

export default async function ContactPage({ params }: ContactPageProps) {
  const locale = resolveLocaleParam(await params);
  setRequestLocale(locale);

  return <ContactContentBody locale={locale} />;
}
