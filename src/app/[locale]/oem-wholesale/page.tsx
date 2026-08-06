import {
  generateLocaleStaticParams,
  type LocaleParam,
} from "@/app/[locale]/generate-static-params";
import {
  generateStaticMdxPageMetadata,
  StaticMdxPage,
} from "@/app/[locale]/static-mdx-page";

const pageConfig = {
  pageType: "oemWholesale",
  slug: "oem-wholesale",
  shell: "landing",
} as const;

interface OemWholesalePageProps {
  params: Promise<LocaleParam>;
}

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export function generateMetadata(props: OemWholesalePageProps) {
  return generateStaticMdxPageMetadata(props, pageConfig);
}

export default function OemWholesalePage({ params }: OemWholesalePageProps) {
  return <StaticMdxPage params={params} config={pageConfig} />;
}
