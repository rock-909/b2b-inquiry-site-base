import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import {
  generateStaticMdxPageMetadata,
  StaticMdxPage,
} from "@/app/[locale]/static-mdx-page";

const pageConfig = {
  pageType: "specificationsGuide",
  slug: "flood-barrier-specifications",
  schemaType: "Article",
} as const;

interface SpecificationsGuidePageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export function generateMetadata(props: SpecificationsGuidePageProps) {
  return generateStaticMdxPageMetadata(props, pageConfig);
}

export default function SpecificationsGuidePage({
  params,
}: SpecificationsGuidePageProps) {
  return <StaticMdxPage params={params} config={pageConfig} />;
}
