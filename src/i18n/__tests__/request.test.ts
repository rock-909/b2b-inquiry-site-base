import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LOCALES_CONFIG,
  type ConfiguredLocale,
} from "@/config/paths/locales-config";

const EN_LOCALE = "en" satisfies ConfiguredLocale;

interface RequestConfigResult {
  locale: ConfiguredLocale;
  timeZone: string;
  formats: {
    number: {
      currency: {
        currency: string;
      };
    };
  };
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

  it("registers a getRequestConfig callback", async () => {
    await import("../request");
    expect(mockGetRequestConfig).toHaveBeenCalledWith(expect.any(Function));
  });

  it("returns english request config", async () => {
    const result = await runConfig(EN_LOCALE);

    expect(result.locale).toBe(EN_LOCALE);
    expect(result.timeZone).toBe("UTC");
    expect(result.formats.number.currency.currency).toBe("USD");
    expect(result.strictMessageTypeSafety).toBe(true);
    expect(result.messages).toBeDefined();
  });

  it("falls back to default locale when requestLocale is invalid", async () => {
    const result = await runConfig("invalid");

    expect(result.locale).toBe(LOCALES_CONFIG.defaultLocale);
  });

  it("falls back to default locale when requestLocale is null", async () => {
    const result = await runConfig(null);

    expect(result.locale).toBe(LOCALES_CONFIG.defaultLocale);
  });

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
