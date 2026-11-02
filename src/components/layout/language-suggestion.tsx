"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { FinalUrlLink, usePathname } from "@/i18n/routing";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";
import { buttonVariants } from "@/components/ui/button-variants";
import { useLocaleSwitchHref } from "@/components/layout/use-locale-switch-href";
import {
  findSuggestedLocale,
  PREFERRED_LOCALE_STORAGE_KEY,
  rememberPreferredLocale,
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

const BAR_ID_PREFIX = "language-suggestion-";

function decide(locale: ConfiguredLocale): ConfiguredLocale | null {
  return findSuggestedLocale(
    locale,
    LOCALES_CONFIG.locales,
    PREFERRED_LOCALE_STORAGE_KEY,
  );
}

// 首屏绘制前运行：用客户端同一个判断函数，把该显示的那一条去掉 hidden。
// 只在服务端生成；客户端渲染的 <script> 不会执行，用 text/plain 避免 React 的开发警告。
function prePaintScript(locale: ConfiguredLocale): string {
  const args = [locale, LOCALES_CONFIG.locales, PREFERRED_LOCALE_STORAGE_KEY]
    .map((value) => JSON.stringify(value).replaceAll("<", "\\u003c"))
    .join(",");
  return `try{var s=(${findSuggestedLocale.toString()})(${args});if(s){var b=document.getElementById(${JSON.stringify(BAR_ID_PREFIX)}+s);if(b)b.hidden=false}}catch(e){}`;
}

/**
 * 语言建议条：页面最顶部、页头之上的整宽横条，占文档流，不覆盖内容。
 * 服务端为每种可建议的语言各输出一条（默认 hidden），紧随其后的内联脚本在首屏绘制前
 * 显示应该出现的那一条，所以显示与否不会引起布局偏移。无 JS 时不显示，也不做任何重定向。
 */
export function LanguageSuggestion({ locale, copy }: LanguageSuggestionProps) {
  const pathname = usePathname();
  const localeSwitchHref = useLocaleSwitchHref(pathname);
  // 水合时与内联脚本读同一来源，初始状态与脚本改过的 DOM 一致。
  const [suggested, setSuggested] = useState<ConfiguredLocale | null>(() =>
    typeof window === "undefined" ? null : decide(locale),
  );

  useEffect(() => {
    // 换路由后按新页面的备用地址重新判断。
    queueMicrotask(() => setSuggested(decide(locale)));
  }, [locale, pathname]);

  const candidates = LOCALES_CONFIG.locales.filter(
    (candidate) => candidate !== locale,
  );

  return (
    <>
      {candidates.map((candidate) => {
        const text = copy[candidate];
        return (
          <div
            key={candidate}
            id={`${BAR_ID_PREFIX}${candidate}`}
            hidden={suggested !== candidate}
            suppressHydrationWarning
            role="region"
            aria-label={text.label}
            lang={candidate}
            className="border-b border-border bg-muted pt-[env(safe-area-inset-top,0px)] text-foreground"
          >
            <div className="mx-auto flex max-w-[1080px] items-center gap-3 px-6 py-1.5">
              <p className="min-w-0 flex-1 text-sm leading-6">
                {text.message}{" "}
                <FinalUrlLink
                  href={localeSwitchHref(candidate)}
                  hrefLang={candidate}
                  onClick={() => rememberPreferredLocale(candidate)}
                  className="text-link whitespace-nowrap"
                >
                  {text.switchAction}
                </FinalUrlLink>
              </p>
              <button
                type="button"
                aria-label={text.dismiss}
                onClick={() => {
                  rememberPreferredLocale(locale);
                  setSuggested(null);
                }}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon" }),
                  "-mr-2 size-8 shrink-0 text-muted-foreground",
                )}
              >
                <X aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      })}
      {/* nosemgrep: nextjs-unsafe-dangerouslySetInnerHTML -- 首屏前判断语言建议条的内联脚本；内容由本模块的函数源码和语言配置生成，不含访客输入，参数里的 < 已转义 */}
      <script
        type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{
          __html: typeof window === "undefined" ? prePaintScript(locale) : "",
        }}
      />
    </>
  );
}
