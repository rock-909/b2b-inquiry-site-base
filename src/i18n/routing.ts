import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing-config";

// Re-export the routing config from edge-safe module
export { routing, type Locale } from "@/i18n/routing-config";

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
// NOTE: These exports pull in React Server Component code and are NOT edge-safe.
// For middleware/runtime entrypoints, import routing from '@/i18n/routing-config' instead.
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
