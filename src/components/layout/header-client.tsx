"use client";

import { lazy, Suspense, useState, type ReactNode } from "react";
import { MobileNavigationFallback } from "@/components/layout/header-mobile-navigation-fallback";

const MobileNavigationInteractive = lazy(() =>
  import("@/components/layout/mobile-navigation-interactive").then((mod) => ({
    default: mod.MobileNavigationInteractive,
  })),
);

interface MobileNavigationIslandProps {
  children?: ReactNode;
  openMenuLabel: string;
  closeMenuLabel: string;
}

export function MobileNavigationIsland({
  children,
  openMenuLabel,
  closeMenuLabel,
}: MobileNavigationIslandProps) {
  const [isActivated, setIsActivated] = useState(false);
  const fallback = (
    <MobileNavigationFallback
      openMenuLabel={openMenuLabel}
      onActivate={() => setIsActivated(true)}
    >
      {children}
    </MobileNavigationFallback>
  );

  if (isActivated) {
    return (
      <Suspense fallback={fallback}>
        <MobileNavigationInteractive
          initialOpen
          openMenuLabel={openMenuLabel}
          closeMenuLabel={closeMenuLabel}
        />
      </Suspense>
    );
  }

  return fallback;
}
