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
        "relative isolate flex h-8 rounded-full bg-background p-1 ring-1 ring-border",
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
            className="relative size-6 rounded-full"
            disabled={!isHydrated}
            key={key}
            onClick={() => setTheme(key)}
            type="button"
          >
            {isHydrated && isActive ? (
              <div
                className="absolute inset-0 rounded-full bg-muted transition-colors duration-150"
                data-testid="theme-switcher-highlight"
                style={{
                  transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
                }}
              />
            ) : null}
            <Icon
              className={cn(
                "relative z-10 m-auto size-4",
                isHydrated && isActive
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            />
          </button>
        );
      })}
    </div>
  );
};
