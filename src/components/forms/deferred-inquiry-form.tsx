"use client";

import {
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";
import type { InquiryFormCopy } from "@/components/forms/inquiry-form";

const InquiryForm = lazy(() =>
  import("@/components/forms/inquiry-form").then((module) => ({
    default: module.InquiryForm,
  })),
);

const RESERVE_CLASS_NAME =
  "min-h-[660px] min-[390px]:min-h-[600px] sm:min-h-[560px] md:min-h-[480px]";

export function DeferredInquiryForm({
  copy,
  fallback,
  initialMessage,
}: {
  copy: InquiryFormCopy;
  fallback: ReactNode;
  initialMessage?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActivated, setIsActivated] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state -- 该能力只能在客户端确认；放进 SSR initializer 会造成水合状态不一致。
      setIsActivated(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setIsActivated(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px" },
    );
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={RESERVE_CLASS_NAME}
      data-inquiry-form-deferred
    >
      <noscript>
        <style>{"[data-inquiry-form-deferred]{min-height:0}"}</style>
      </noscript>
      {isActivated ? (
        <Suspense fallback={fallback}>
          <InquiryForm
            copy={copy}
            fallback={fallback}
            {...(initialMessage ? { initialMessage } : {})}
          />
        </Suspense>
      ) : (
        fallback
      )}
    </div>
  );
}
