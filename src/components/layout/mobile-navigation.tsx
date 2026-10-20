import { NavigationPending } from "@/components/navigation/navigation-pending";
import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { PATHS_CONFIG } from "@/config/paths/paths-config";
import { SINGLE_SITE_NAVIGATION } from "@/config/single-site-navigation";
import { isActivePath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/routing";
import { buttonVariants } from "@/components/ui/button-variants";

export interface MobileNavigationLinksProps extends Omit<
  ComponentProps<"nav">,
  "children"
> {
  contactSalesLabel?: string;
  currentPathname?: string;
  languageSwitcher?: ReactNode;
  onNavigate?: () => void;
}

export function MobileNavigationLinks({
  className,
  contactSalesLabel,
  currentPathname,
  languageSwitcher,
  onNavigate,
  ...props
}: MobileNavigationLinksProps) {
  const t = useTranslations("navigation");
  const tAccessibility = useTranslations("accessibility");
  const resolvedContactSalesLabel = contactSalesLabel ?? t("contactSales");
  const contactHref = PATHS_CONFIG.contact;

  return (
    <nav
      aria-label={tAccessibility("mobileNavigation")}
      className={cn("flex flex-col space-y-1", className)}
      {...props}
    >
      <ul className="space-y-1">
        {SINGLE_SITE_NAVIGATION.map((item) => {
          const isActive =
            typeof currentPathname === "string" &&
            isActivePath(currentPathname, item.href);

          return (
            <li key={item.key}>
              <Link
                href={item.href as "/"}
                prefetch={false}
                className={cn(
                  "flex min-h-11 items-center rounded-[var(--control-radius)] px-3 text-base font-medium transition-colors duration-150 ease-out",
                  isActive
                    ? "text-[var(--primary-text)]"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
              >
                {t(item.messageKey)}
                <NavigationPending />
              </Link>
            </li>
          );
        })}
        <li className="pt-3">
          <Link
            href={contactHref}
            prefetch={false}
            className={buttonVariants({ className: "h-11 w-full text-base" })}
            onClick={onNavigate}
          >
            {resolvedContactSalesLabel}
            <NavigationPending />
          </Link>
        </li>
      </ul>
      {languageSwitcher ? (
        <div className="mt-4 border-t border-border pt-4">
          {languageSwitcher}
        </div>
      ) : null}
    </nav>
  );
}
