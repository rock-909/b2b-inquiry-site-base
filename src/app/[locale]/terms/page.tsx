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

const pageConfig: StaticContentPageConfig = {
  pageType: "terms",
  slug: "terms",
} as const;

export function generateStaticParams() {
  return generateLocaleStaticParams();
}

export function generateMetadata(props: {
  params: Promise<LocaleParam>;
}): Promise<Metadata> {
  return generateStaticContentPageMetadata(props, pageConfig);
}

// 本页在构建期就整页预渲染，没有请求期数据可等；经 StaticContentPage 统一
// 渲染（与 about 一致），禁用脚本访客由 fallback 承载。
export default async function TermsPage({
  params,
}: {
  params: Promise<LocaleParam>;
}) {
  return await StaticContentPage({ params, config: pageConfig });
}
