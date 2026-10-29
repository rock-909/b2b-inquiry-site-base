"use client";

import { OPEN_CONSENT_EVENT } from "@/lib/cookie-consent/types";

// 撤回同意要和给出同意一样容易（GDPR 7(3)）：重新打开同意横幅。
export function CookieSettingsButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
      className="inline-block cursor-pointer rounded-sm py-1 text-left text-sm text-muted-foreground transition-colors duration-150 ease-out hover:text-foreground"
    >
      {label}
    </button>
  );
}
