"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

interface LazyIslandErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface LazyIslandErrorBoundaryState {
  hasError: boolean;
}

/**
 * Keeps optional lazy-loaded islands from taking down their parent UI when a
 * chunk fails to load or the island throws during render.
 */
export class LazyIslandErrorBoundary extends Component<
  LazyIslandErrorBoundaryProps,
  LazyIslandErrorBoundaryState
> {
  override state: LazyIslandErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): LazyIslandErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  override render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
