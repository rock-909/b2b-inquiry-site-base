"use client";

import { useSyncExternalStore } from "react";
import { getLocalePath, type ConfiguredLocale } from "@/config/paths";

const SERVER_URL_STATE = "";

function subscribeToUrlState(onStoreChange: () => void): () => void {
  window.addEventListener("popstate", onStoreChange);
  window.addEventListener("hashchange", onStoreChange);

  return () => {
    window.removeEventListener("popstate", onStoreChange);
    window.removeEventListener("hashchange", onStoreChange);
  };
}

function getBrowserUrlState(): string {
  return `${window.location.search}${window.location.hash}`;
}

function getServerUrlState(): string {
  return SERVER_URL_STATE;
}

export function useLocaleSwitchHref<Pathname extends string>(
  pathname: Pathname,
) {
  const urlState = useSyncExternalStore(
    subscribeToUrlState,
    getBrowserUrlState,
    getServerUrlState,
  );

  return (locale: ConfiguredLocale) =>
    `${getLocalePath(locale, pathname)}${urlState}`;
}
