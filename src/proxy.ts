import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getOfferingById } from "@/config/offerings";
import { routing } from "@/i18n/routing-config";

const intlMiddleware = createMiddleware(routing);
// next.config 在构建时内联公开资源清单，不读取运行时环境或文件系统。
const publicAssetPaths = new Set<string>(
  // eslint-disable-next-line no-process-env -- Next 构建常量必须使用直接属性访问才能内联
  JSON.parse(process.env.PUBLIC_ASSET_PATHS ?? "[]"),
);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/u, "") || "/";
  if (publicAssetPaths.has(pathname)) {
    return NextResponse.next();
  }
  const localePrefix = routing.locales.find(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  const publicPath = localePrefix
    ? pathname.slice(localePrefix.length + 1) || "/"
    : pathname;
  const productMatch = publicPath.match(/^\/products\/([^/]+)$/u);
  const productId = productMatch?.[1];
  const isKnownStaticPath = Object.hasOwn(routing.pathnames, publicPath);

  if (!isKnownStaticPath && (!productId || !getOfferingById(productId))) {
    const notFoundUrl = request.nextUrl.clone();
    // 保留已识别的语言前缀，避免非默认语言的 404 被改写成默认语言页面
    notFoundUrl.pathname = `/${localePrefix ?? routing.defaultLocale}/__not-found-placeholder`;
    return NextResponse.rewrite(notFoundUrl, { status: 404 });
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/",
    "/((?!api(?:/|$)|_next(?:/|$)|robots\\.txt$|sitemap\\.xml$|icon\\.svg$|security-policy\\.txt$).*)",
  ],
};
