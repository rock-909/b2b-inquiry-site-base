"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { flushSync } from "react-dom";
import { ChevronDown } from "lucide-react";
import { HeaderNavLink } from "@/components/layout/header-nav-link";
import { NavigationPending } from "@/components/navigation/navigation-pending";
import { usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export interface HeaderNavSubLink {
  key: string;
  href: string;
  label: string;
  external?: boolean | undefined;
}

export interface HeaderNavGroup {
  key: string;
  label: string;
  links: HeaderNavSubLink[];
}

export type HeaderNavItem =
  | { key: string; label: string; href: string; groups?: never }
  | { key: string; label: string; href?: never; groups: HeaderNavGroup[] };

type OpenVia = "pointer" | "click" | "keyboard";

interface OpenState {
  key: string;
  via: OpenVia;
  pathname: string;
}

// 与 vercel.com 实测一致：悬停约 100ms 后展开，指针离开约 150ms 后收起。
const HOVER_OPEN_DELAY_MS = 100;
const HOVER_CLOSE_DELAY_MS = 150;

const TOP_ITEM_CLASS =
  "relative inline-flex h-8 items-center rounded-[var(--control-radius)] px-3 text-sm font-medium text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground";

const SUB_LINK_CLASS =
  "group inline-flex items-center gap-1 rounded-sm text-xl leading-8 font-normal text-foreground";

// 下划线只画在文字 span 上，不延伸到 ↗；颜色不变、无底色。
const SUB_LINK_TEXT_CLASS =
  "decoration-[var(--nav-link-underline)] decoration-1 underline-offset-[5px] group-hover:underline";

const panelId = (key: string) => `header-nav-panel-${key}`;

// 面板内有键盘焦点时，指针移动不收起或切换面板。
const isFocusInPanel = () =>
  Boolean(document.activeElement?.closest("[data-nav-panel]"));

// 方向键的移动范围：面板内上下键、Home/End 走全部链接（左右键不处理）；顶层左右键走各顶层项。
function getArrowTargets(
  list: HTMLUListElement,
  target: HTMLElement,
  key: string,
) {
  const panel = target.closest<HTMLElement>("[data-nav-panel]");
  if (panel) {
    return key === "ArrowLeft" || key === "ArrowRight"
      ? []
      : [...panel.querySelectorAll<HTMLElement>("a")];
  }
  return key === "ArrowLeft" || key === "ArrowRight"
    ? [...list.querySelectorAll<HTMLElement>(":scope > li > :is(a, button)")]
    : [];
}

function moveFocus(items: HTMLElement[], current: HTMLElement, key: string) {
  const index = items.indexOf(current);
  const last = items.length - 1;
  const next = {
    ArrowDown: Math.min(index + 1, last),
    ArrowRight: Math.min(index + 1, last),
    ArrowUp: Math.max(index - 1, 0),
    ArrowLeft: Math.max(index - 1, 0),
    Home: 0,
    End: last,
  }[key];
  if (index < 0 || next === undefined) return false;
  items[next]?.focus();
  return true;
}

// 键盘与点击处理挂在真正的按钮和链接上，由 HeaderNavMenuBar 统一提供。
interface ControlHandlers {
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onNavigate: () => void;
}

function SubLink({
  link,
  handlers,
}: {
  link: HeaderNavSubLink;
  handlers: ControlHandlers;
}) {
  const text = (
    <span className={SUB_LINK_TEXT_CLASS} translate="no">
      {link.label}
    </span>
  );

  if (link.external) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className={SUB_LINK_CLASS}
        onClick={handlers.onNavigate}
        onKeyDown={handlers.onKeyDown}
      >
        {text}
        <span aria-hidden="true">↗</span>
      </a>
    );
  }

  return (
    <HeaderNavLink
      href={link.href}
      className={SUB_LINK_CLASS}
      onClick={handlers.onNavigate}
      onKeyDown={handlers.onKeyDown}
    >
      {text}
      <NavigationPending />
    </HeaderNavLink>
  );
}

function TopLevelLink({
  item,
  handlers,
}: {
  item: { key: string; href: string; label: string };
  handlers: ControlHandlers;
}) {
  return (
    <HeaderNavLink
      href={item.href}
      onKeyDown={handlers.onKeyDown}
      className={cn(
        TOP_ITEM_CLASS,
        "aria-[current=page]:text-foreground",
        // 悬停或展开其它项时当前页文字退回次要色，一次只高亮一处。
        "[ul:has(:is(a,button):hover)_&[aria-current=page]:not(:hover)]:text-muted-foreground",
        "[ul:has([aria-expanded=true])_&[aria-current=page]]:text-muted-foreground",
      )}
    >
      <span data-testid={`header-nav-label-${item.key}`} translate="no">
        {item.label}
      </span>
      <NavigationPending />
    </HeaderNavLink>
  );
}

function MenuPanel({
  id,
  groups,
  isOpen,
  handlers,
}: {
  id: string;
  groups: HeaderNavGroup[];
  isOpen: boolean;
  handlers: ControlHandlers;
}) {
  return (
    // 相对 sticky 页头定位，整宽贴在页头下方；before 桥接按钮与面板间的空隙，after 是页面遮罩。
    <div
      id={id}
      data-nav-panel=""
      hidden={!isOpen}
      className="absolute inset-x-0 top-full border-b border-border bg-background before:absolute before:inset-x-0 before:bottom-full before:h-4 after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-dvh after:bg-background/50"
    >
      <div className="mx-auto flex max-w-[1080px] flex-wrap gap-x-4 gap-y-6 px-6 pt-1 pb-6">
        {groups.map((group) => (
          <div key={group.key} className="min-w-[250px]">
            <div className="text-sm text-muted-foreground" translate="no">
              {group.label}
            </div>
            <ul aria-label={group.label} className="mt-[5px] flex flex-col">
              {group.links.map((link) => (
                <li key={link.key}>
                  <SubLink link={link} handlers={handlers} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuItem({
  item,
  isOpen,
  onPointerEnter,
  onPointerLeave,
  onTriggerClick,
  handlers,
}: {
  item: { key: string; label: string; groups: HeaderNavGroup[] };
  isOpen: boolean;
  handlers: ControlHandlers;
  onPointerEnter: (event: PointerEvent) => void;
  onPointerLeave: (event: PointerEvent) => void;
  onTriggerClick: (event: MouseEvent) => void;
}) {
  return (
    <li onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId(item.key)}
        data-nav-trigger={item.key}
        className={cn(TOP_ITEM_CLASS, "gap-1 aria-expanded:text-foreground")}
        onClick={onTriggerClick}
        onKeyDown={handlers.onKeyDown}
      >
        <span translate="no">{item.label}</span>
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-3.5 transition-transform duration-150 ease-out motion-reduce:transition-none",
            isOpen && "rotate-180",
          )}
        />
      </button>
      <MenuPanel
        id={panelId(item.key)}
        groups={item.groups}
        isOpen={isOpen}
        handlers={handlers}
      />
    </li>
  );
}

// 桌面主导航。二级菜单按 WAI-ARIA disclosure 模式实现：按钮 + aria-expanded，
// 面板始终在服务端 HTML 里（关闭时 hidden），搜索引擎和 AI 抓取不依赖 JS。
export function HeaderNavMenuBar({ items }: { items: HeaderNavItem[] }) {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [openState, setOpenState] = useState<OpenState | null>(null);
  // 换路由即视为关闭，不依赖组件卸载。
  const openKey =
    openState && openState.pathname === pathname ? openState.key : null;

  const clearTimer = () => clearTimeout(timerRef.current);
  const open = (key: string, via: OpenVia) =>
    setOpenState({ key, via, pathname });
  const close = () => {
    clearTimer();
    setOpenState(null);
  };

  useEffect(() => {
    if (openKey === null) return undefined;
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (listRef.current?.contains(event.target as Node)) return;
      clearTimeout(timerRef.current);
      setOpenState(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openKey]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const openAndFocusFirstLink = (key: string) => {
    clearTimer();
    flushSync(() => open(key, "keyboard"));
    document.getElementById(panelId(key))?.querySelector("a")?.focus();
  };

  const handlePointerEnter = (key: string, event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    clearTimer();
    if (openKey === key || isFocusInPanel()) return;
    // 已有面板展开时直接切换，不再等待。
    if (openKey !== null) open(key, "pointer");
    else
      timerRef.current = setTimeout(
        () => open(key, "pointer"),
        HOVER_OPEN_DELAY_MS,
      );
  };

  const handlePointerLeave = (event: PointerEvent) => {
    if (event.pointerType === "touch") return;
    clearTimer();
    if (openKey !== null)
      timerRef.current = setTimeout(() => {
        if (!isFocusInPanel()) close();
      }, HOVER_CLOSE_DELAY_MS);
  };

  const handleTriggerClick = (key: string, event: MouseEvent) => {
    clearTimer();
    // detail 为 0 表示键盘 Enter/Space 触发：展开并把焦点移到第一项。
    if (event.detail === 0) {
      if (openKey === key) close();
      else openAndFocusFirstLink(key);
      return;
    }
    // 悬停刚展开时的点击保持展开，再点一次才收起。
    if (openKey === key && openState?.via === "pointer") open(key, "click");
    else if (openKey === key) close();
    else open(key, "click");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const list = listRef.current;
    const target = event.currentTarget;
    if (!list) return;
    if (event.key === "Escape" && openKey !== null) {
      event.preventDefault();
      close();
      list
        .querySelector<HTMLElement>(`[aria-controls="${panelId(openKey)}"]`)
        ?.focus();
    } else if (event.key === "ArrowDown" && target.dataset.navTrigger) {
      event.preventDefault();
      openAndFocusFirstLink(target.dataset.navTrigger);
    } else if (
      moveFocus(getArrowTargets(list, target, event.key), target, event.key)
    ) {
      event.preventDefault();
    }
  };

  const handlers: ControlHandlers = {
    onKeyDown: handleKeyDown,
    onNavigate: close,
  };

  return (
    <ul
      ref={listRef}
      className="header-desktop-only header-nav-links-compact items-center"
      onFocus={(event) => {
        if (event.target.closest("[data-nav-trigger], [data-nav-panel]"))
          clearTimer();
      }}
      onBlur={(event) => {
        // 焦点移到导航以外时收起，避免展开的面板遮住后续焦点。
        const next = event.relatedTarget;
        if (next && !event.currentTarget.contains(next)) close();
      }}
    >
      {items.map((item) =>
        item.groups ? (
          <MenuItem
            key={item.key}
            item={item}
            isOpen={openKey === item.key}
            onPointerEnter={(event) => handlePointerEnter(item.key, event)}
            onPointerLeave={handlePointerLeave}
            onTriggerClick={(event) => handleTriggerClick(item.key, event)}
            handlers={handlers}
          />
        ) : (
          <li key={item.key}>
            <TopLevelLink item={item} handlers={handlers} />
          </li>
        ),
      )}
    </ul>
  );
}
