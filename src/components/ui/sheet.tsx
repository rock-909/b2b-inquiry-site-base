"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// 键盘触发（菜单按钮或链接上按 Enter、Escape）时抽屉直接开合，不播放滑动。
const SheetInstantContext = React.createContext(false);

function isKeyboardTriggered(event: Event) {
  if (event instanceof KeyboardEvent) return true;
  // 键盘激活按钮或链接时浏览器派发的 click 的 detail 为 0；指针点击和触屏点按为 1 及以上。
  return event instanceof MouseEvent && event.detail === 0;
}

interface SheetProps extends React.ComponentProps<typeof SheetPrimitive.Root> {
  /** 本次开合是否来自键盘；为 true 时遮罩和抽屉都不播放过渡。 */
  instant?: boolean;
}

function Sheet({ instant = false, ...props }: SheetProps) {
  return (
    <SheetInstantContext.Provider value={instant}>
      <SheetPrimitive.Root {...props} />
    </SheetInstantContext.Provider>
  );
}

function SheetTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetPortal({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Portal>) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Backdrop>) {
  const instant = React.useContext(SheetInstantContext);

  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      data-instant={instant ? "" : undefined}
      className={cn(
        "absolute inset-0 z-50 bg-[var(--overlay-scrim)] transition-opacity duration-150 ease-[ease] data-[ending-style]:opacity-0 data-[instant]:transition-none starting:opacity-0",
        className,
      )}
      {...props}
    />
  );
}

function SheetViewport({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Viewport>) {
  return (
    <SheetPrimitive.Viewport
      data-slot="sheet-viewport"
      className={cn("pointer-events-none fixed inset-0 z-50", className)}
      {...props}
    />
  );
}

interface SheetContentProps extends React.ComponentProps<
  typeof SheetPrimitive.Popup
> {
  closeLabel: string;
}

function SheetContent({
  className,
  children,
  closeLabel,
  ...props
}: SheetContentProps) {
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);
  const instant = React.useContext(SheetInstantContext);
  const {
    "aria-describedby": ariaDescribedBy,
    initialFocus,
    ...restProps
  } = props;

  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetViewport>
        <SheetPrimitive.Popup
          data-slot="sheet-content"
          data-instant={instant ? "" : undefined}
          className={cn(
            "pointer-events-auto absolute inset-y-0 right-0 flex h-full w-3/4 flex-col gap-4 border-l bg-background p-6 shadow-lg sm:max-w-sm",
            // 用过渡而不是关键帧：滑入途中关闭时从当前位置原路退回，不先跳到全开。
            // 入场用原生 @starting-style：懒加载岛首次挂载就是打开状态，Base UI 不会给它 data-starting-style。
            "transition-[translate] duration-250 ease-(--ease-drawer) data-[ending-style]:translate-x-full data-[ending-style]:duration-200 starting:translate-x-full",
            "data-[instant]:transition-none motion-reduce:transition-none",
            className,
          )}
          initialFocus={initialFocus ?? closeButtonRef}
          {...(ariaDescribedBy !== undefined
            ? { "aria-describedby": ariaDescribedBy }
            : {})}
          {...restProps}
        >
          {children}
          <SheetPrimitive.Close
            ref={closeButtonRef}
            className="absolute top-4 right-4 inline-flex size-10 items-center justify-center rounded-[var(--control-radius)] text-foreground transition-colors duration-150 ease-out hover:bg-muted disabled:pointer-events-none"
          >
            <XIcon className="size-4" />
            <span className="sr-only">{closeLabel}</span>
          </SheetPrimitive.Close>
        </SheetPrimitive.Popup>
      </SheetViewport>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1.5 p-4", className)}
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  isKeyboardTriggered,
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
