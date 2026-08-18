import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import {
  generateStaticContentPageMetadata,
  StaticContentPage,
} from "@/app/[locale]/static-content-page";

const pageConfig = {
  pageType: "about",
  slug: "about",
} as const;

interface AboutPageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export function generateMetadata(props: AboutPageProps) {
  return generateStaticContentPageMetadata(props, pageConfig);
}

export default function AboutPage({ params }: AboutPageProps) {
  return <StaticContentPage params={params} config={pageConfig} />;
}
