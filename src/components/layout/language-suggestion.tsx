"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { FinalUrlLink, usePathname } from "@/i18n/routing";
import type { ConfiguredLocale } from "@/config/paths/locales-config";
import { buttonVariants } from "@/components/ui/button-variants";
import { useLocaleSwitchHref } from "@/components/layout/use-locale-switch-href";
import {
  rememberPreferredLocale,
  resolvePreferredLocale,
} from "@/lib/i18n/preferred-locale";
import { cn } from "@/lib/utils";

export interface LanguageSuggestionCopy {
  label: string;
  message: string;
  switchAction: string;
  dismiss: string;
}

interface LanguageSuggestionProps {
  locale: ConfiguredLocale;
  /** 每种语言的提示文案都由服务端预先给出，提示用建议的语言显示，不再发请求。 */
  copy: Record<ConfiguredLocale, LanguageSuggestionCopy>;
}

const CSS_VAR_SUGGESTION_SPACE = "--language-suggestion-space";
// 页脚为提示条额外留出的空白：条高加上它距视口底部的最大偏移，页面滚到底时不挡住页脚控件。
const SUGGESTION_EDGE_SPACE_PX = 40;

// 当前页面声明了该语言的 hreflang 备用地址，才算真的有这个语言版本（404 页没有）。
function pageHasLocaleVersion(locale: ConfiguredLocale): boolean {
  return (
    document.head.querySelector(
      `link[rel="alternate"][hreflang="${CSS.escape(locale)}"]`,
    ) !== null
  );
}

function findSuggestedLocale(
  currentLocale: ConfiguredLocale,
): ConfiguredLocale | null {
  const preferred = resolvePreferredLocale();
  return preferred &&
    preferred !== currentLocale &&
    pageHasLocaleVersion(preferred)
    ? preferred
    : null;
}

/**
 * 语言建议条：只在浏览器里判断，服务端与无 JS 页面不输出任何内容，
 * 也不做任何重定向。固定在底部居中，不占文档流，不会引起布局偏移。
 */
export function LanguageSuggestion({ locale, copy }: LanguageSuggestionProps) {
  const pathname = usePathname();
  const localeSwitchHref = useLocaleSwitchHref(pathname);
  const [suggested, setSuggested] = useState<ConfiguredLocale | null>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 浏览器语言与存储只能在挂载后读取；换路由后按新页面的备用地址重新判断。
    const decide = () => setSuggested(findSuggestedLocale(locale));
    queueMicrotask(decide);
  }, [locale, pathname]);

  useEffect(() => {
    const pill = pillRef.current;
    if (!pill) return undefined;

    const root = document.documentElement;
    const updateSpace = () => {
      root.style.setProperty(
        CSS_VAR_SUGGESTION_SPACE,
        `${pill.getBoundingClientRect().height + SUGGESTION_EDGE_SPACE_PX}px`,
      );
    };
    updateSpace();

    const observer = new ResizeObserver(updateSpace);
    observer.observe(pill);
    return () => {
      observer.disconnect();
      root.style.setProperty(CSS_VAR_SUGGESTION_SPACE, "0px");
    };
  }, [suggested]);

  if (suggested === null) return null;

  const text = copy[suggested];
  const dismiss = () => {
    rememberPreferredLocale(locale);
    setSuggested(null);
  };

  return (
    <div
      role="region"
      aria-label={text.label}
      lang={suggested}
      data-testid="language-suggestion"
      // 叠放：同意卡片显示时整条抬到卡片上方（--cookie-banner-height 由卡片写入），
      // 移动端卡片贴底，sm 起卡片距底 1.25rem；卡片不在时变量为 0，回到默认位置。
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--cookie-banner-height)+0.75rem)] z-40 flex justify-center px-4 sm:bottom-[calc(var(--cookie-banner-height)+min(var(--cookie-banner-height),0.75rem)+1.25rem)]"
    >
      <div
        ref={pillRef}
        className="pointer-events-auto flex max-w-full items-center gap-2 rounded-[var(--card-radius)] border border-border bg-popover/80 py-1.5 pr-1.5 pl-4 text-popover-foreground shadow-lg backdrop-blur-md duration-200 animate-in fade-in-0 slide-in-from-bottom-2 sm:gap-3 sm:rounded-full"
      >
        <p className="min-w-0 text-[13px] leading-5 sm:text-sm">
          {text.message}
        </p>
        <FinalUrlLink
          href={localeSwitchHref(suggested)}
          hrefLang={suggested}
          onClick={() => rememberPreferredLocale(suggested)}
          className={buttonVariants({
            size: "sm",
            className: "rounded-full",
          })}
        >
          {text.switchAction}
        </FinalUrlLink>
        <button
          type="button"
          aria-label={text.dismiss}
          onClick={dismiss}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "size-8 rounded-full text-muted-foreground",
          )}
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
