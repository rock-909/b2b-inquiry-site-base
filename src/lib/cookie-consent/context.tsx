"use client";

/**
 * Cookie Consent React Context
 *
 * Provides cookie consent state and actions throughout the app.
 * Uses useSyncExternalStore for SSR-safe hydration from localStorage.
 */
import {
  createContext,
  use,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  clearConsent,
  createAcceptAllConsent,
  createRejectAllConsent,
  loadConsent,
  saveConsent,
} from "@/lib/cookie-consent/storage";
import {
  DEFAULT_CONSENT,
  type CookieCategory,
  type CookieConsent,
  type CookieConsentContextValue,
} from "@/lib/cookie-consent/types";

const CookieConsentContext = createContext<CookieConsentContextValue | null>(
  null,
);

// External store for consent state (enables useSyncExternalStore pattern)
type ConsentListener = () => void;
let consentListeners: ConsentListener[] = [];
let cachedConsent: CookieConsent = DEFAULT_CONSENT;
let cachedHasConsented = false;
let cachedReady = false;
// Cached snapshot object to maintain referential stability for useSyncExternalStore
let cachedSnapshot = {
  consent: cachedConsent,
  hasConsented: cachedHasConsented,
  ready: cachedReady,
};
// Track if client-side initialization has occurred (for hydration safety)
let isClientInitialized = false;
// Track if hydration is complete - critical for avoiding hydration mismatch
let isHydrated = false;

function emitChange() {
  for (const listener of consentListeners) {
    listener();
  }
}

function subscribeToConsent(listener: ConsentListener): () => void {
  // Lazy initialization on first subscription (after hydration)
  if (typeof window !== "undefined" && !isClientInitialized) {
    isClientInitialized = true;
    const stored = loadConsent();
    if (stored) {
      cachedConsent = stored.consent;
      cachedHasConsented = true;
      cachedSnapshot = {
        consent: cachedConsent,
        hasConsented: cachedHasConsented,
        ready: cachedReady,
      };
    }
    // Mark hydration complete and notify after microtask to ensure
    // first render uses SERVER_SNAPSHOT for hydration consistency
    queueMicrotask(() => {
      cachedReady = true;
      cachedSnapshot = {
        consent: cachedConsent,
        hasConsented: cachedHasConsented,
        ready: cachedReady,
      };
      isHydrated = true;
      emitChange();
    });
  }
  consentListeners = [...consentListeners, listener];
  return () => {
    consentListeners = consentListeners.filter((l) => l !== listener);
  };
}

function getConsentSnapshot(): {
  consent: CookieConsent;
  hasConsented: boolean;
  ready: boolean;
} {
  // During hydration, return server snapshot to ensure consistency
  // After hydration (isHydrated=true), return actual cached state
  return isHydrated ? cachedSnapshot : SERVER_SNAPSHOT;
}

// Server snapshot is constant - prevents hydration mismatches
const SERVER_SNAPSHOT: {
  consent: CookieConsent;
  hasConsented: boolean;
  ready: boolean;
} = {
  consent: DEFAULT_CONSENT,
  hasConsented: false,
  ready: false,
};

function getServerSnapshot(): {
  consent: CookieConsent;
  hasConsented: boolean;
  ready: boolean;
} {
  return SERVER_SNAPSHOT;
}

function updateConsentStore(
  newConsent: CookieConsent,
  newHasConsented: boolean,
) {
  cachedConsent = newConsent;
  cachedHasConsented = newHasConsented;
  cachedReady = true;
  cachedSnapshot = {
    consent: cachedConsent,
    hasConsented: cachedHasConsented,
    ready: cachedReady,
  };
  emitChange();
}

interface CookieConsentProviderProps {
  children: ReactNode;
}

export function CookieConsentProvider({
  children,
}: CookieConsentProviderProps) {
  const { consent, hasConsented, ready } = useSyncExternalStore(
    subscribeToConsent,
    getConsentSnapshot,
    getServerSnapshot,
  );

  const acceptAll = useCallback(() => {
    const newConsent = createAcceptAllConsent();
    saveConsent(newConsent);
    updateConsentStore(newConsent, true);
  }, []);

  const rejectAll = useCallback(() => {
    const newConsent = createRejectAllConsent();
    saveConsent(newConsent);
    updateConsentStore(newConsent, true);
  }, []);

  const updateConsent = useCallback(
    (category: Exclude<CookieCategory, "necessary">, value: boolean) => {
      const newConsent = { ...cachedConsent, [category]: value };
      saveConsent(newConsent);
      updateConsentStore(newConsent, true);
    },
    [],
  );

  const savePreferences = useCallback(
    (preferences: Partial<Omit<CookieConsent, "necessary">>) => {
      const newConsent = {
        ...cachedConsent,
        ...preferences,
        necessary: true as const,
      };
      saveConsent(newConsent);
      updateConsentStore(newConsent, true);
    },
    [],
  );

  const resetConsent = useCallback(() => {
    clearConsent();
    updateConsentStore(DEFAULT_CONSENT, false);
  }, []);

  const value = useMemo<CookieConsentContextValue>(
    () => ({
      consent,
      hasConsented,
      ready,
      acceptAll,
      rejectAll,
      updateConsent,
      savePreferences,
      resetConsent,
    }),
    [
      consent,
      hasConsented,
      ready,
      acceptAll,
      rejectAll,
      updateConsent,
      savePreferences,
      resetConsent,
    ],
  );

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
    </CookieConsentContext.Provider>
  );
}

/** Hook to access cookie consent state and actions */
export function useCookieConsent(): CookieConsentContextValue {
  const context = use(CookieConsentContext);
  if (!context) {
    throw new Error(
      "useCookieConsent must be used within CookieConsentProvider",
    );
  }
  return context;
}

/** Optional hook that returns null if outside provider (for conditional use) */
export function useCookieConsentOptional(): CookieConsentContextValue | null {
  return use(CookieConsentContext);
}
