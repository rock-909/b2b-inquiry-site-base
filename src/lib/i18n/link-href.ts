import type { ComponentProps } from "react";
import type { Link } from "@/i18n/routing";

/**
 * Type for next-intl's Link `href` prop. Supports both string paths and
 * `{ pathname, params }` objects for dynamic routes.
 */
export type LinkHref = ComponentProps<typeof Link>["href"];
