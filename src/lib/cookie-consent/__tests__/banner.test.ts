/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONSENT_PENDING_SCRIPT } from "@/lib/cookie-consent/banner";
import { loadConsent } from "@/lib/cookie-consent/storage";
import {
  CONSENT_PENDING_DATASET_KEY,
  CONSENT_STORAGE_KEY,
  CONSENT_VERSION,
} from "@/lib/cookie-consent/types";

const UPDATED_AT = "2026-08-09T00:00:00.000Z";
const CURRENT = {
  consent: { necessary: true, analytics: true, advertising: false },
  updatedAt: UPDATED_AT,
  version: CONSENT_VERSION,
};

function storeRaw(raw: string) {
  window.localStorage.setItem(CONSENT_STORAGE_KEY, raw);
}

function store(record: unknown) {
  storeRaw(JSON.stringify(record));
}

function denyStorage(method: "getItem" | "setItem", name: string) {
  vi.spyOn(Storage.prototype, method).mockImplementation(() => {
    throw new DOMException("Storage blocked", name);
  });
}

// 每个用例都写明预期：没有有效记录时卡片要从首帧显示（pending）。
const CASES: { name: string; pending: boolean; arrange: () => void }[] = [
  { name: "no record", pending: true, arrange: () => undefined },
  { name: "empty string", pending: true, arrange: () => storeRaw("") },
  { name: "malformed JSON", pending: true, arrange: () => storeRaw("{") },
  { name: "JSON null", pending: true, arrange: () => storeRaw("null") },
  { name: "JSON number", pending: true, arrange: () => storeRaw("3") },
  { name: "current record", pending: false, arrange: () => store(CURRENT) },
  {
    name: "current record rejecting everything",
    pending: false,
    arrange: () =>
      store({
        ...CURRENT,
        consent: { necessary: true, analytics: false, advertising: false },
      }),
  },
  {
    name: "version 2 record without advertising",
    pending: true,
    arrange: () =>
      store({
        consent: { necessary: true, analytics: true },
        updatedAt: UPDATED_AT,
        version: 2,
      }),
  },
  {
    name: "current version without advertising",
    pending: true,
    arrange: () =>
      store({
        ...CURRENT,
        consent: { necessary: true, analytics: true },
      }),
  },
  {
    name: "older version with every field",
    pending: true,
    arrange: () => store({ ...CURRENT, version: CONSENT_VERSION - 1 }),
  },
  {
    name: "newer version",
    pending: true,
    arrange: () => store({ ...CURRENT, version: CONSENT_VERSION + 1 }),
  },
  {
    name: "version as a string",
    pending: true,
    arrange: () => store({ ...CURRENT, version: String(CONSENT_VERSION) }),
  },
  {
    name: "missing updatedAt",
    pending: true,
    arrange: () =>
      store({ consent: CURRENT.consent, version: CONSENT_VERSION }),
  },
  {
    name: "necessary not true",
    pending: true,
    arrange: () =>
      store({ ...CURRENT, consent: { ...CURRENT.consent, necessary: false } }),
  },
  {
    name: "analytics not boolean",
    pending: true,
    arrange: () =>
      store({ ...CURRENT, consent: { ...CURRENT.consent, analytics: "yes" } }),
  },
  {
    name: "consent null",
    pending: true,
    arrange: () => store({ ...CURRENT, consent: null }),
  },
  {
    name: "consent a string",
    pending: true,
    arrange: () => store({ ...CURRENT, consent: "all" }),
  },
  {
    name: "current record but storage too full to write",
    pending: true,
    arrange: () => {
      store(CURRENT);
      denyStorage("setItem", "QuotaExceededError");
    },
  },
  {
    name: "current record but reads blocked",
    pending: true,
    arrange: () => {
      store(CURRENT);
      denyStorage("getItem", "SecurityError");
    },
  },
  {
    name: "localStorage itself throws",
    pending: true,
    arrange: () => {
      vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
        throw new DOMException("Storage blocked", "SecurityError");
      });
    },
  },
];

function runPendingScript(): boolean {
  // 与 layout 一样作为内联 <script> 插入；jsdom 插入时同步执行一次。
  const script = document.createElement("script");
  script.textContent = CONSENT_PENDING_SCRIPT;
  document.body.append(script);
  script.remove();
  return (
    document.documentElement.dataset[CONSENT_PENDING_DATASET_KEY] !== undefined
  );
}

describe("consent pending pre-paint script", () => {
  beforeEach(() => {
    window.localStorage.clear();
    delete document.documentElement.dataset[CONSENT_PENDING_DATASET_KEY];
  });
  afterEach(() => vi.restoreAllMocks());

  it.each(CASES)(
    "agrees with loadConsent for $name",
    ({ arrange, pending }) => {
      arrange();
      // 先跑脚本：loadConsent 会删掉无效记录。
      const scriptPending = runPendingScript();
      const storedConsent = loadConsent();

      expect(scriptPending).toBe(pending);
      expect(storedConsent === null).toBe(pending);
    },
  );
});
