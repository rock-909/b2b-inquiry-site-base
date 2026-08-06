import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import {
  generateStaticMdxPageMetadata,
  StaticMdxPage,
} from "@/app/[locale]/static-mdx-page";

const pageConfig = {
  pageType: "warranty",
  slug: "warranty",
} as const;

interface WarrantyPageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export function generateMetadata(props: WarrantyPageProps) {
  return generateStaticMdxPageMetadata(props, pageConfig);
}

export default function WarrantyPage({ params }: WarrantyPageProps) {
  return <StaticMdxPage params={params} config={pageConfig} />;
}
