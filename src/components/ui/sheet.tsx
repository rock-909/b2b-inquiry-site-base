"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "@base-ui/react/dialog";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function Sheet({ ...props }: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root {...props} />;
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
  return (
    <SheetPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "absolute inset-0 z-50 bg-black/50 data-[closed]:animate-out data-[closed]:fade-out-0 data-[open]:animate-in data-[open]:fade-in-0",
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
          className={cn(
            "pointer-events-auto absolute inset-y-0 right-0 flex h-full w-3/4 flex-col gap-4 border-l bg-background p-6 shadow-lg transition ease-in-out data-[closed]:duration-300 data-[closed]:animate-out data-[open]:duration-500 data-[open]:animate-in",
            "data-[closed]:slide-out-to-right data-[open]:slide-in-from-right sm:max-w-sm",
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
            className="absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none"
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
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
};
