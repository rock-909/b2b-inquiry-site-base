import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import {
  generateStaticMdxPageMetadata,
  StaticMdxPage,
} from "@/app/[locale]/static-mdx-page";

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
  return generateStaticMdxPageMetadata(props, pageConfig);
}

export default function AboutPage({ params }: AboutPageProps) {
  return <StaticMdxPage params={params} config={pageConfig} />;
}
