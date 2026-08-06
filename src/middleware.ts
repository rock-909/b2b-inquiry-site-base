import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";
import { routing } from "@/i18n/routing-config";
import { HTTP_NOT_FOUND } from "@/constants";

const intlMiddleware = createMiddleware(routing);

const PLAIN_NOT_FOUND_HEADERS = {
  "content-type": "text/plain; charset=utf-8",
  "x-robots-tag": "noindex, nofollow",
} as const;

function isRetiredLocalePath(pathname: string): boolean {
  return LOCALES_CONFIG.retiredLocales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
}

function createPlainNotFound() {
  return new NextResponse("Not Found", {
    status: HTTP_NOT_FOUND,
    headers: PLAIN_NOT_FOUND_HEADERS,
  });
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (isRetiredLocalePath(pathname)) {
    return createPlainNotFound();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/", "/((?!api|_next|.*\\..*).*)"],
};
