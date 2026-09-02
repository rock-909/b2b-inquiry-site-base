import { createNavigation } from "next-intl/navigation";
// eslint-disable-next-line no-restricted-imports -- 语言切换已有最终 URL，不能再经过 next-intl 重写前缀。
import NextLink from "next/link";
import { routing } from "@/i18n/routing-config";

// Re-export the routing config from the runtime-safe module.
export { routing, type Locale } from "@/i18n/routing-config";

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
// NOTE: These exports pull in React Server Component code and are not runtime-safe.
// For proxy/runtime entrypoints, import routing from '@/i18n/routing-config' instead.
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);

export { NextLink as FinalUrlLink };
