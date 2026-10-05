import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { getOfferingById } from "@/config/offerings";
import { routing } from "@/i18n/routing-config";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname.replace(/\/+$/u, "") || "/";
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
  matcher: ["/", "/((?!api|_next|.*\\..*).*)"],
};
