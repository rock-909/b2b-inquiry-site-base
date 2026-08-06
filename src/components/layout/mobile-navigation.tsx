import type { ComponentProps } from "react";
import { useTranslations } from "next-intl";
import { SINGLE_SITE_HOME_LINK_TARGETS } from "@/config/single-site-links";
import { isActivePath, mobileNavigation } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";

export interface MobileNavigationLinksProps extends Omit<
  ComponentProps<"nav">,
  "children"
> {
  contactSalesLabel?: string;
  currentPathname?: string;
  onNavigate?: () => void;
}

export function MobileNavigationLinks({
  className,
  contactSalesLabel,
  currentPathname,
  onNavigate,
  ...props
}: MobileNavigationLinksProps) {
  const t = useTranslations("navigation");
  const tAccessibility = useTranslations("accessibility");
  const resolvedContactSalesLabel = contactSalesLabel ?? t("contactSales");
  const contactHref =
    SINGLE_SITE_HOME_LINK_TARGETS.requestQuote ??
    SINGLE_SITE_HOME_LINK_TARGETS.contact;

  return (
    <nav
      aria-label={tAccessibility("mobileNavigation")}
      className={cn("flex flex-col space-y-1", className)}
      {...props}
    >
      <ul className="space-y-1">
        {mobileNavigation.map((item) => {
          const isActive =
            typeof currentPathname === "string" &&
            isActivePath(currentPathname, item.href);

          return (
            <li key={item.key}>
              <Link
                href={item.href as "/"}
                prefetch={false}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors duration-200",
                  isActive
                    ? "bg-accent text-[var(--primary-text)]"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
              >
                {t(item.messageKey)}
              </Link>
            </li>
          );
        })}
        {contactHref ? (
          <li className="pt-4">
            <Link
              href={{
                pathname: contactHref,
                query: { source: "mobile_nav_cta" },
              }}
              prefetch={false}
              className="flex items-center rounded-md bg-[var(--button-primary-bg)] px-3 py-2 text-sm font-medium text-[var(--button-primary-fg)] transition-colors duration-200 hover:bg-[var(--button-primary-hover-bg)]"
              onClick={onNavigate}
            >
              {resolvedContactSalesLabel}
            </Link>
          </li>
        ) : null}
      </ul>
    </nav>
  );
}
