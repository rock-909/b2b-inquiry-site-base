"use client";

// eslint-disable-next-line no-restricted-imports -- 仅读取 Next Link 的原生 pending 状态，不绕过 locale 链接入口。
import { useLinkStatus } from "next/link";

export function NavigationPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;

  return (
    <span
      aria-hidden="true"
      data-testid="navigation-pending"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 animate-pulse bg-primary motion-reduce:animate-none"
    />
  );
}
