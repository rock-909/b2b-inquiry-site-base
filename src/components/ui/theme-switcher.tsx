"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const themes = [
  {
    key: "system",
    icon: Monitor,
    labelKey: "switchToSystem",
  },
  {
    key: "light",
    icon: Sun,
    labelKey: "switchToLight",
  },
  {
    key: "dark",
    icon: Moon,
    labelKey: "switchToDark",
  },
] as const;

const unsubscribeHydration = () => undefined;
const subscribeHydration = () => unsubscribeHydration;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

export type ThemeSwitcherProps = React.HTMLAttributes<HTMLDivElement>;

export const ThemeSwitcher = ({ className, ...rest }: ThemeSwitcherProps) => {
  const tTheme = useTranslations("theme");
  const tAccessibility = useTranslations("accessibility");
  const { resolvedTheme, theme, setTheme } = useTheme();
  const isHydrated = useSyncExternalStore(
    subscribeHydration,
    getClientHydrationSnapshot,
    getServerHydrationSnapshot,
  );
  const activeTheme = theme ?? resolvedTheme;

  return (
    <div
      aria-label={tAccessibility("themeSelector")}
      className={cn(
        "relative isolate flex h-7 items-center gap-0.5 rounded-md border border-[var(--footer-divider)] bg-transparent p-0.5",
        className,
      )}
      role="group"
      {...rest}
    >
      {themes.map(({ key, icon: Icon, labelKey }) => {
        const isActive = activeTheme === key;

        return (
          <button
            aria-label={tTheme(labelKey)}
            aria-pressed={isHydrated ? isActive : undefined}
            className="relative flex size-6 items-center justify-center rounded-[calc(var(--control-radius)-0.25rem)] text-[var(--footer-text)] transition-[background-color,color] duration-150 hover:bg-muted hover:text-[var(--footer-heading)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--footer-bg)] focus-visible:outline-none"
            disabled={!isHydrated}
            key={key}
            onClick={() => setTheme(key)}
            type="button"
          >
            {isHydrated && isActive ? (
              <div
                className="pointer-events-none absolute inset-0 rounded-[calc(var(--control-radius)-0.25rem)] bg-muted transition-colors duration-150"
                data-testid="theme-switcher-highlight"
                style={{
                  transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            ) : null}
            <Icon
              className={cn(
                "relative z-10 size-3.5",
                isHydrated && isActive
                  ? "text-[var(--footer-heading)]"
                  : "text-[var(--footer-text)]",
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
