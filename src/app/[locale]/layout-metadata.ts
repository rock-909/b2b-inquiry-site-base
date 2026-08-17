import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SINGLE_SITE_CONFIG } from "@/config/single-site";
import { isLocale } from "@/i18n/locale-utils";
import { getRuntimeAppEnv, getRuntimeEnvString } from "@/lib/env";

const INDEXABLE_ROBOTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-video-preview": -1,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
} as const satisfies Metadata["robots"];

const NOINDEX_ROBOTS = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
} as const satisfies Metadata["robots"];

/**
 * Locale layout metadata (base only).
 *
 * Next.js metadata is shallow-merged: page routes that don't explicitly return
 * `alternates` or `openGraph` may inherit those fields from layouts.
 *
 * This function intentionally avoids returning `alternates` / `openGraph` to
 * prevent polluting all child pages. Per-page metadata should be generated via
 * path-aware helpers (see `generateMetadataForPath`).
 */
export async function generateLocaleMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  // 元数据生成先于布局渲染执行。布局里那句 `if (!isLocale(locale)) notFound()`
  // 因此永远来不及拦住非法 locale：带点的地址（`/random.txt`）被 proxy
  // matcher 排除，原样落到 `[locale]` 上，某个页面的 generateMetadata 拿它去查
  // 路径表，直接 `throw new Error("Unknown locale")`，返回 500。
  // 同一句校验放在最早的入口这里，非法 locale 走正常的 404 兜底，而不是异常。
  // 见 docs/架构与行为.md 的路由行为契约
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }

  const metadataBaseUrl = SINGLE_SITE_CONFIG.baseUrl || "http://localhost:3000";

  return {
    metadataBase: new URL(metadataBaseUrl),
    title: {
      default: SINGLE_SITE_CONFIG.seo.defaultTitle,
      template: SINGLE_SITE_CONFIG.seo.titleTemplate,
    },
    description: SINGLE_SITE_CONFIG.seo.defaultDescription,
    robots:
      getRuntimeAppEnv() === "production" ? INDEXABLE_ROBOTS : NOINDEX_ROBOTS,
    verification: {
      google: getRuntimeEnvString("GOOGLE_SITE_VERIFICATION"),
      yandex: getRuntimeEnvString("YANDEX_VERIFICATION"),
    },
  };
}
