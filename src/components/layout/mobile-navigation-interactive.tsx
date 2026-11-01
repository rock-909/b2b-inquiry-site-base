"use client";

// Current split: MobileNavigationLinks (server-rendered fallback) + this file (client interactivity).
// Content assembly (MobileNavigationHeader, drawer layout) still lives here.
// A deeper RSC boundary refactor would move content assembly to the server shell.

import { useState, type ComponentProps, type ReactNode } from "react";
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

function isKeyboardTriggered(event: Event) {
  if (event instanceof KeyboardEvent) return true;
  // 键盘激活按钮或链接时浏览器派发的 click 的 detail 为 0；指针点击和触屏点按为 1 及以上。
  return event instanceof MouseEvent && event.detail === 0;
}

interface MobileNavigationInteractiveProps {
  closeMenuLabel: string;
  initialOpen?: boolean;
  /** 首次打开来自键盘时为 true，抽屉直接出现。 */
  initialInstant?: boolean;
  languageSwitcher?: ReactNode;
  openMenuLabel: string;
  siteName: string;
}

interface MobileMenuButtonProps extends ComponentProps<"button"> {
  closeMenuLabel: string;
  isOpen: boolean;
  openMenuLabel: string;
}

interface MobileMenuState {
  instant: boolean;
  isOpen: boolean;
  pathname: string;
}

function MobileMenuButton({
  isOpen,
  className,
  onClick,
  openMenuLabel,
  closeMenuLabel,
  ...props
}: MobileMenuButtonProps) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn("relative", className)}
      aria-expanded={isOpen}
      data-testid="header-mobile-menu-button"
      onClick={onClick}
      {...props}
    >
      {isOpen ? <X className="size-4" /> : <Menu className="size-4" />}
      <span
        className="sr-only"
        data-testid="mobile-menu-toggle-label"
        translate="no"
      >
        {isOpen ? closeMenuLabel : openMenuLabel}
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
    <SheetHeader className="h-10 justify-center p-0 pr-12 text-left">
      <SheetTitle className="sr-only">{mobileNavigationLabel}</SheetTitle>
      <div className="truncate text-base font-semibold" aria-hidden="true">
        {siteName}
      </div>
      <SheetDescription className="sr-only">{siteDescription}</SheetDescription>
    </SheetHeader>
  );
}

export function MobileNavigationInteractive({
  initialOpen = false,
  initialInstant = false,
  languageSwitcher,
  openMenuLabel,
  closeMenuLabel,
  siteName,
}: MobileNavigationInteractiveProps) {
  const tNavigation = useTranslations("navigation");
  const tAccessibility = useTranslations("accessibility");
  const pathname = usePathname();
  const [menuState, setMenuState] = useState<MobileMenuState>(() => ({
    instant: initialInstant,
    isOpen: initialOpen,
    pathname,
  }));
  const isOpen = menuState.pathname === pathname && menuState.isOpen;

  const handleOpenChange = (open: boolean, event: Event) => {
    setMenuState({
      instant: isKeyboardTriggered(event),
      isOpen: open,
      pathname,
    });
  };

  return (
    <div className="header-mobile-only">
      <Sheet
        instant={menuState.instant}
        open={isOpen}
        onOpenChange={(open, eventDetails) =>
          handleOpenChange(open, eventDetails.event)
        }
      >
        <SheetTrigger
          render={
            <MobileMenuButton
              isOpen={isOpen}
              aria-controls="mobile-navigation"
              closeMenuLabel={closeMenuLabel}
              openMenuLabel={openMenuLabel}
            />
          }
        />
        <SheetContent
          closeLabel={closeMenuLabel}
          className="w-[320px] gap-3 overflow-y-auto p-4 sm:w-[360px]"
          id="mobile-navigation"
          data-testid="mobile-menu-content"
        >
          <MobileNavigationHeader
            mobileNavigationLabel={tAccessibility("mobileNavigation")}
            siteDescription={tNavigation("siteDescription")}
            siteName={siteName}
          />

          <MobileNavigationLinks
            currentPathname={pathname}
            languageSwitcher={languageSwitcher}
            onNavigate={(event) => handleOpenChange(false, event.nativeEvent)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
