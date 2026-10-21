"use client";

import type { KeyboardEventHandler, ReactNode } from "react";
import { Link, usePathname } from "@/i18n/routing";
import { isActivePath } from "@/lib/navigation";

// 桌面主导航只为 aria-current 读取当前路径；头部其余部分仍是服务端组件。
export function HeaderNavLink({
  href,
  className,
  children,
  onClick,
  onKeyDown,
}: {
  href: string;
  className: string;
  children: ReactNode;
  onClick?: () => void;
  onKeyDown?: KeyboardEventHandler<HTMLAnchorElement>;
}) {
  const pathname = usePathname();

  return (
    <Link
      href={href as "/"}
      prefetch={false}
      className={className}
      aria-current={isActivePath(pathname, href) ? "page" : undefined}
      onClick={onClick}
      onKeyDown={onKeyDown}
    >
      {children}
    </Link>
  );
}
