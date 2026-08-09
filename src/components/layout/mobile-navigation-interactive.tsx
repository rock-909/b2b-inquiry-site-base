"use client";

// Current split: MobileNavigationLinks (server-rendered fallback) + this file (client interactivity).
// Content assembly (MobileNavigationHeader, drawer layout) still lives here.
// A deeper RSC boundary refactor would move content assembly to the server shell.

import { useState, type ComponentProps } from "react";
import { Menu, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { MobileNavigationLinks } from "@/components/layout/mobile-navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetTrigger,
} from "@/components/ui/sheet";

interface MobileNavigationInteractiveProps {
  closeMenuLabel: string;
  initialOpen?: boolean;
  openMenuLabel: string;
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

export function MobileNavigationInteractive({
  initialOpen = false,
  openMenuLabel,
  closeMenuLabel,
}: MobileNavigationInteractiveProps) {
  const tNavigation = useTranslations("navigation");
  const tAccessibility = useTranslations("accessibility");
  const pathname = usePathname();
  const [menuState, setMenuState] = useState<MobileMenuState>(() => ({
    isOpen: initialOpen,
    pathname,
  }));
  const isOpen = menuState.pathname === pathname && menuState.isOpen;

  const handleOpenChange = (open: boolean) => {
    setMenuState((currentState) => ({
      ...currentState,
      isOpen: open,
      pathname,
    }));
  };

  return (
    <div className="header-mobile-only">
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
          closeLabel={closeMenuLabel}
          className="w-[300px] overflow-y-auto sm:w-[350px]"
          id="mobile-navigation"
          data-testid="mobile-menu-content"
          onEscapeKeyDown={() => handleOpenChange(false)}
        >
          <MobileNavigationHeader
            mobileNavigationLabel={tAccessibility("mobileNavigation")}
            siteDescription={tNavigation("siteDescription")}
            siteName={tNavigation("siteName")}
          />
          <div className="my-4 h-px w-full shrink-0 bg-border" />
          <MobileNavigationLinks
            currentPathname={pathname}
            onNavigate={() => handleOpenChange(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
