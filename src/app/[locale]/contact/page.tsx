import type { Metadata } from "next";
import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import {
  generateStaticContentPageMetadata,
  StaticContentPage,
  type StaticContentPageConfig,
} from "@/app/[locale]/static-content-page";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import {
  ContactFormWithFallback,
  ContactMethodsCard,
} from "@/app/[locale]/contact/contact-page-sections";

const pageConfig: StaticContentPageConfig = {
  pageType: "contact",
} as const;

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export function generateMetadata(props: {
  params: Promise<LocaleParam>;
}): Promise<Metadata> {
  return generateStaticContentPageMetadata(props, pageConfig);
}

export default async function ContactPage({
  params,
}: {
  params: Promise<LocaleParam>;
}) {
  const locale = resolveLocaleParam(await params);

  return await StaticContentPage({
    params,
    config: pageConfig,
    children: (
      <>
        <ContactFormWithFallback locale={locale} />
        <ContactMethodsCard locale={locale} />
      </>
    ),
  });
}
