"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { logger } from "@/lib/logger";

interface LazyIslandBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
}

interface LazyIslandBoundaryState {
  hasError: boolean;
}

/**
 * 用户交互触发的按需加载（React.lazy）失败时，把错误限制在当前岛内。
 * React.lazy 会缓存被拒绝的结果，重试渲染无法恢复，因此不提供 reset，
 * 直接保留页面并退回该岛已有的静态兜底；刷新页面后才会重新加载分块。
 */
export class LazyIslandBoundary extends Component<
  LazyIslandBoundaryProps,
  LazyIslandBoundaryState
> {
  override state: LazyIslandBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazyIslandBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error("Lazy island failed to load", error, info.componentStack);
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}
