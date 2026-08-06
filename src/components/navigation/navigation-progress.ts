interface NavigationClickState {
  defaultPrevented: boolean;
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

export function getNavigationTargetRouteKey(
  anchor: HTMLAnchorElement,
  currentHref: string,
): string | null {
  if (anchor.target === "_blank") {
    return null;
  }

  const href = anchor.getAttribute("href");
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return null;
  }

  try {
    const target = new URL(href, currentHref);
    const current = new URL(currentHref);

    if (target.origin !== current.origin) {
      return null;
    }

    const targetRouteKey = getNavigationRouteKey(
      target.pathname,
      target.searchParams,
    );
    const currentRouteKey = getNavigationRouteKey(
      current.pathname,
      current.searchParams,
    );
    if (targetRouteKey === currentRouteKey) {
      return null;
    }

    return targetRouteKey;
  } catch {
    return null;
  }
}

export function shouldStartNavigationProgress(
  event: NavigationClickState,
  anchor: HTMLAnchorElement,
  currentHref: string,
): boolean {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
    return false;
  }
  if (anchor.hasAttribute("download")) return false;

  return getNavigationTargetRouteKey(anchor, currentHref) !== null;
}

export function getNavigationRouteKey(
  pathname: string,
  searchParams: Pick<URLSearchParams, "toString">,
): string {
  const search = searchParams.toString();
  return `${pathname}${search ? `?${search}` : ""}`;
}

export function shouldStartHistoryNavigationProgress(
  previousRouteKey: string | null,
  nextRouteKey: string,
): boolean {
  return previousRouteKey !== null && previousRouteKey !== nextRouteKey;
}
