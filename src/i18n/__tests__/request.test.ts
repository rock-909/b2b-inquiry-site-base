import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";

const EN_LOCALE = "en" satisfies ConfiguredLocale;

interface RequestConfigResult {
  locale: ConfiguredLocale;
  timeZone: string;
  strictMessageTypeSafety: boolean;
  messages: unknown;
}

const { mockGetRequestConfig, mockLoadCompleteMessages, mockRootLocale } =
  vi.hoisted(() => ({
    mockGetRequestConfig: vi.fn(),
    mockLoadCompleteMessages: vi.fn(),
    mockRootLocale: vi.fn(),
  }));

vi.mock("next-intl/server", () => ({
  getRequestConfig: mockGetRequestConfig,
}));

vi.mock("next/root-params", () => ({
  locale: mockRootLocale,
}));

vi.mock("@/lib/i18n/load-messages", () => ({
  loadCompleteMessages: mockLoadCompleteMessages,
}));

describe("i18n Request Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mockLoadCompleteMessages.mockResolvedValue({
      common: { loading: "Loading..." },
    });
    mockRootLocale.mockResolvedValue(EN_LOCALE);
  });

  async function runConfig(
    requestLocale: string | null,
  ): Promise<RequestConfigResult> {
    let captured: (() => Promise<unknown>) | undefined;

    mockGetRequestConfig.mockImplementation((fn) => {
      captured = fn;
      return fn;
    });

    await import("../request");

    if (!captured) {
      throw new Error("getRequestConfig callback was not captured");
    }

    mockRootLocale.mockResolvedValue(requestLocale);
    return (await captured()) as RequestConfigResult;
  }

  it("returns the request locale with its own time zone and loaded messages", async () => {
    const locale =
      LOCALES_CONFIG.locales.find(
        (candidate) => candidate !== LOCALES_CONFIG.defaultLocale,
      ) ?? LOCALES_CONFIG.defaultLocale;
    const loadedMessages = { navigation: { home: "Loaded home" } };
    mockLoadCompleteMessages.mockResolvedValue(loadedMessages);

    const result = await runConfig(locale);

    expect(result).toEqual({
      locale,
      timeZone: LOCALES_CONFIG.timeZones[locale],
      strictMessageTypeSafety: true,
      messages: loadedMessages,
    });
    expect(mockLoadCompleteMessages).toHaveBeenCalledWith(locale);
  });

  it.each(["invalid", null])(
    "falls back to default locale when requestLocale is %s",
    async (requestLocale) => {
      const result = await runConfig(requestLocale);

      expect(result.locale).toBe(LOCALES_CONFIG.defaultLocale);
    },
  );

  it("surfaces deterministic message load failures without retrying", async () => {
    mockLoadCompleteMessages.mockRejectedValue(new Error("source failed"));

    await expect(runConfig(LOCALES_CONFIG.defaultLocale)).rejects.toThrow(
      "source failed",
    );
    expect(mockLoadCompleteMessages).toHaveBeenCalledOnce();
    expect(mockLoadCompleteMessages).toHaveBeenCalledWith(
      LOCALES_CONFIG.defaultLocale,
    );
  });
});
