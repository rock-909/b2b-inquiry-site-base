import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { LocalizedNotFoundView } from "@/components/errors/localized-not-found-view";
import { resolveLocaleParam } from "@/i18n/locale-utils";
import { routing } from "@/i18n/routing";

export function generateMetadata(): Metadata {
  return {
    robots: {
      index: false,
      follow: false,
    },
  };
}

// proxy 将未知公开路径改写到占位页，并设置 HTTP 404。
// 页面直接渲染恢复内容，避免 notFound() 只输出空壳、等待客户端恢复。
export function generateStaticParams() {
  return routing.locales.map((locale) => ({
    locale,
    rest: ["__not-found-placeholder"],
  }));
}

export default async function CatchAllNotFound({
  params,
}: {
  params: Promise<{ locale: string; rest: string[] }>;
}) {
  const routeParams = await params;
  // 非占位请求仍由 Next 设置 404，不能直接渲染成 HTTP 200。
  if (
    routeParams.rest.length !== 1 ||
    routeParams.rest[0] !== "__not-found-placeholder"
  ) {
    notFound();
  }
  setRequestLocale(resolveLocaleParam(routeParams));
  return <LocalizedNotFoundView />;
}
