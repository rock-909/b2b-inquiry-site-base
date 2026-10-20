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
        "flex h-9 items-center gap-0.5 rounded-[var(--control-radius)] border border-border bg-transparent p-0.5",
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
            className={cn(
              "flex size-8 items-center justify-center rounded-[calc(var(--control-radius)-0.125rem)] transition-colors duration-150 ease-out",
              isHydrated && isActive
                ? "bg-background text-foreground ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground",
            )}
            disabled={!isHydrated}
            key={key}
            onClick={() => setTheme(key)}
            type="button"
          >
            <Icon aria-hidden="true" className="size-4" />
          </button>
        );
      })}
    </div>
  );
};
