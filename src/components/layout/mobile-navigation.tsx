import { NavigationPending } from "@/components/navigation/navigation-pending";
import type { ComponentProps, ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { PATHS_CONFIG } from "@/config/paths/paths-config";
import {
  SINGLE_SITE_NAVIGATION,
  type SiteNavigationItem,
} from "@/config/single-site-navigation";
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
          if (item.groups) {
            return (
              <li key={item.key}>
                <MobileNavigationGroups
                  item={item}
                  currentPathname={currentPathname}
                  onNavigate={onNavigate}
                />
              </li>
            );
          }
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
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
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

const SUB_LINK_CLASS =
  "flex min-h-11 items-center gap-1 rounded-[var(--control-radius)] px-3 text-base text-foreground decoration-[var(--nav-link-underline)] decoration-1 underline-offset-[5px] aria-[current=page]:underline";

// 带 groups 的项在抽屉里用原生 details 折叠展开（同 Vercel），无 JS 也能用。
function MobileNavigationGroups({
  item,
  currentPathname,
  onNavigate,
}: {
  item: Extract<SiteNavigationItem, { groups: readonly unknown[] }>;
  currentPathname?: string | undefined;
  onNavigate?: (() => void) | undefined;
}) {
  const t = useTranslations("navigation");

  return (
    <details name="mobile-navigation-groups" className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-[var(--control-radius)] px-3 text-base font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground [&::-webkit-details-marker]:hidden">
        {t(item.messageKey)}
        <ChevronDown
          aria-hidden="true"
          className="size-4 shrink-0 text-foreground group-open:rotate-180"
        />
      </summary>
      <div className="flex flex-col gap-6 px-3 pt-2 pb-4">
        {item.groups.map((group) => (
          <div key={group.key}>
            <div className="mb-2 text-sm font-medium text-muted-foreground">
              {t(group.messageKey)}
            </div>
            <ul
              aria-label={t(group.messageKey)}
              className="-mx-3 flex flex-col"
            >
              {group.links.map((link) => (
                <li key={link.key}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={SUB_LINK_CLASS}
                      onClick={onNavigate}
                    >
                      {t(link.messageKey)}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <Link
                      href={link.href as "/"}
                      prefetch={false}
                      className={SUB_LINK_CLASS}
                      aria-current={
                        currentPathname !== undefined &&
                        isActivePath(currentPathname, link.href)
                          ? "page"
                          : undefined
                      }
                      onClick={onNavigate}
                    >
                      {t(link.messageKey)}
                      <NavigationPending />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
