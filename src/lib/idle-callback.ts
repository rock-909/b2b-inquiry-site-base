/**
 * requestIdleCallback工具函数
 * 提供类型安全的requestIdleCallback调用，自动fallback到setTimeout
 */

import {
  IDLE_CALLBACK_FALLBACK_DELAY,
  IDLE_CALLBACK_TIMEOUT,
} from "@/constants/time";

/**
 * 类型安全的requestIdleCallback调用
 * 如果浏览器不支持requestIdleCallback，自动fallback到setTimeout
 *
 * @param callback - 要执行的回调函数
 * @param options - 配置选项
 * @param options.timeout - 超时时间（毫秒），默认1200ms
 * @returns 清理函数，用于取消回调
 *
 * @example
 * ```tsx
 * useEffect(() => {
 *   const cleanup = requestIdleCallback(() => {
 *     // 空闲时执行的代码
 *   });
 *   return cleanup;
 * }, []);
 * ```
 */
interface RequestIdleCallbackOptions {
  timeout?: number;
  fallbackDelay?: number;
}

export function requestIdleCallback(
  callback: () => void,
  options: RequestIdleCallbackOptions = {},
): () => void {
  const {
    timeout = IDLE_CALLBACK_TIMEOUT,
    fallbackDelay = IDLE_CALLBACK_FALLBACK_DELAY,
  } = options;
  let canceled = false;

  const runCallback = () => {
    if (canceled) return;
    callback();
  };

  if (typeof window === "undefined") {
    // SSR环境，立即执行
    runCallback();
    return () => {
      canceled = true;
    };
  }

  if (typeof window.requestIdleCallback === "function") {
    // 浏览器支持requestIdleCallback
    const id = window.requestIdleCallback(runCallback, { timeout });
    return () => {
      canceled = true;
      if (typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(id);
      }
    };
  }

  // Fallback到setTimeout
  const id = setTimeout(runCallback, fallbackDelay);
  return () => {
    canceled = true;
    clearTimeout(id);
  };
}
