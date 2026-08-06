import type { ReactNode } from "react";

interface MobileNavigationFallbackProps {
  children?: ReactNode;
  onActivate: () => void;
  openMenuLabel: string;
}

export function MobileNavigationFallback({
  children,
  onActivate,
  openMenuLabel,
}: MobileNavigationFallbackProps) {
  return (
    <details
      className="relative"
      data-testid="header-mobile-navigation-fallback"
    >
      <summary
        className="relative inline-flex size-9 cursor-pointer list-none items-center justify-center rounded-md text-foreground transition-colors duration-150 hover:bg-accent [&::-webkit-details-marker]:hidden"
        aria-controls="mobile-navigation"
        data-testid="header-mobile-menu-button"
        onClick={onActivate}
      >
        <svg
          aria-hidden="true"
          className="size-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            d="M4 7h16M4 12h16M4 17h16"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
        <span
          className="sr-only"
          data-testid="header-mobile-menu-label"
          translate="no"
        >
          {openMenuLabel}
        </span>
      </summary>
      {children ? (
        <div
          id="mobile-navigation"
          className="absolute top-full right-0 z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-border bg-popover p-3 text-popover-foreground shadow-lg"
          data-testid="header-mobile-navigation-fallback-panel"
        >
          {children}
        </div>
      ) : null}
    </details>
  );
}
