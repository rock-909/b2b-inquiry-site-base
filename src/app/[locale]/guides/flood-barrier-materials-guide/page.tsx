import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import {
  generateStaticMdxPageMetadata,
  StaticMdxPage,
} from "@/app/[locale]/static-mdx-page";

const pageConfig = {
  pageType: "materialsGuide",
  slug: "flood-barrier-materials-guide",
  schemaType: "Article",
} as const;

interface MaterialsGuidePageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export function generateMetadata(props: MaterialsGuidePageProps) {
  return generateStaticMdxPageMetadata(props, pageConfig);
}

export default function MaterialsGuidePage({
  params,
}: MaterialsGuidePageProps) {
  return <StaticMdxPage params={params} config={pageConfig} />;
}
