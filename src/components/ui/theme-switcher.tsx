"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Monitor, MoonStar, Sun } from "lucide-react";
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
    icon: MoonStar,
    labelKey: "switchToDark",
  },
] as const;

const unsubscribeHydration = () => undefined;
const subscribeHydration = () => unsubscribeHydration;
const getClientHydrationSnapshot = () => true;
const getServerHydrationSnapshot = () => false;

/** 在下一帧画完之后运行回调；返回取消函数。 */
function afterNextPaint(callback: () => void) {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(callback);
  });
  return () => cancelAnimationFrame(frame);
}

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
  // 水合时选中态从无到有，若此时已有颜色过渡，每次加载都会播一遍淡入；等水合后的样式画出两帧再开启过渡。
  const [canTransition, setCanTransition] = useState(false);
  useEffect(() => {
    if (!isHydrated) return undefined;
    return afterNextPaint(() => setCanTransition(true));
  }, [isHydrated]);

  return (
    <div
      aria-label={tAccessibility("themeSelector")}
      className={cn(
        "flex items-center rounded-full ring-1 ring-border",
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
              "flex size-6 cursor-pointer items-center justify-center rounded-full hover:text-foreground focus-visible:text-foreground disabled:cursor-default",
              canTransition && "transition-colors duration-150 ease-out",
              isHydrated && isActive
                ? "bg-popover text-foreground shadow-xs ring-1 ring-border"
                : "text-[var(--theme-switch-icon)]",
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
