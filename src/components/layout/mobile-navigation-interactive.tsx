"use client";

// Current split: MobileNavigationLinks (server-rendered fallback) + this file (client interactivity).
// Content assembly (MobileNavigationHeader, drawer layout) still lives here.
// A deeper RSC boundary refactor would move content assembly to the server shell.

import {
  cloneElement,
  isValidElement,
  useCallback,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { usePathname } from "@/i18n/routing";
import {
  MobileNavigationLinks,
  type MobileNavigationLinksProps,
} from "@/components/layout/mobile-navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileNavigationInteractiveProps {
  children?: ReactNode;
  className?: string;
  closeMenuLabel: string;
  initialOpen?: boolean;
  openMenuLabel: string;
  siteDescription?: string | undefined;
  siteName?: string | undefined;
}

interface MobileMenuButtonProps extends ComponentProps<"button"> {
  closeMenuLabel?: string | undefined;
  isOpen: boolean;
  labelTestId?: string | undefined;
  openMenuLabel?: string | undefined;
}

interface MobileMenuState {
  isOpen: boolean;
  pathname: string;
}

export function MobileMenuButton({
  isOpen,
  className,
  onClick,
  openMenuLabel,
  closeMenuLabel,
  labelTestId = "mobile-menu-button-label",
  ...props
}: MobileMenuButtonProps) {
  const t = useTranslations("accessibility");
  const label = isOpen
    ? (closeMenuLabel ?? t("closeMenu"))
    : (openMenuLabel ?? t("openMenu"));

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      aria-expanded={isOpen}
      data-state={isOpen ? "open" : "closed"}
      data-testid="header-mobile-menu-button"
      onClick={onClick}
      {...props}
    >
      {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      <span className="sr-only" data-testid={labelTestId} translate="no">
        {label}
      </span>
    </Button>
  );
}

function MobileNavigationHeader({
  siteName,
  siteDescription,
  mobileNavigationLabel,
}: {
  siteDescription: string;
  siteName: string;
  mobileNavigationLabel: string;
}) {
  return (
    <SheetHeader className="text-left">
      <SheetTitle className="sr-only">{mobileNavigationLabel}</SheetTitle>
      <div className="text-lg font-semibold" aria-hidden="true">
        {siteName}
      </div>
      <SheetDescription className="text-sm text-muted-foreground">
        {siteDescription}
      </SheetDescription>
    </SheetHeader>
  );
}

function withInteractiveNavigationProps(
  children: ReactNode,
  props: MobileNavigationLinksProps,
) {
  if (!isValidElement<MobileNavigationLinksProps>(children)) {
    return children;
  }

  return cloneElement(children, props);
}

export function MobileNavigationInteractive({
  children,
  className,
  initialOpen = false,
  openMenuLabel,
  closeMenuLabel,
  siteName,
  siteDescription,
}: MobileNavigationInteractiveProps) {
  const tNavigation = useTranslations("navigation");
  const tAccessibility = useTranslations("accessibility");
  const pathname = usePathname();
  const [menuState, setMenuState] = useState<MobileMenuState>(() => ({
    isOpen: initialOpen,
    pathname,
  }));
  const isOpen = menuState.pathname === pathname && menuState.isOpen;
  const resolvedSiteName = siteName ?? tNavigation("siteName");
  const resolvedSiteDescription =
    siteDescription ?? tNavigation("siteDescription");

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setMenuState((currentState) => ({
        ...currentState,
        isOpen: open,
        pathname,
      }));
    },
    [pathname],
  );

  const navigationContent = children ? (
    withInteractiveNavigationProps(children, {
      currentPathname: pathname,
      onNavigate: () => handleOpenChange(false),
    })
  ) : (
    <MobileNavigationLinks
      currentPathname={pathname}
      onNavigate={() => handleOpenChange(false)}
    />
  );

  return (
    <div className={cn("header-mobile-only", className)}>
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <MobileMenuButton
            isOpen={isOpen}
            aria-controls="mobile-navigation"
            closeMenuLabel={closeMenuLabel}
            openMenuLabel={openMenuLabel}
            labelTestId="mobile-menu-toggle-label"
          />
        </SheetTrigger>
        <SheetContent
          side="right"
          closeLabel={closeMenuLabel}
          className="w-[300px] overflow-y-auto sm:w-[350px]"
          id="mobile-navigation"
          data-testid="mobile-menu-content"
          onEscapeKeyDown={() => handleOpenChange(false)}
        >
          <MobileNavigationHeader
            mobileNavigationLabel={tAccessibility("mobileNavigation")}
            siteDescription={resolvedSiteDescription}
            siteName={resolvedSiteName}
          />
          <Separator className="my-4" />
          {navigationContent}
        </SheetContent>
      </Sheet>
    </div>
  );
}
