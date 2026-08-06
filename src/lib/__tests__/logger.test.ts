import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { logger } from "@/lib/logger";

describe("logger", () => {
  let consoleSpies: Record<
    "debug" | "info" | "log" | "warn" | "error",
    ReturnType<typeof vi.spyOn>
  >;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    consoleSpies = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
      info: vi.spyOn(console, "info").mockImplementation(() => undefined),
      log: vi.spyOn(console, "log").mockImplementation(() => undefined),
      warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
      error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.values(consoleSpies).forEach((spy) => spy.mockRestore());
  });

  it("should forward all logs in development/test environment", () => {
    logger.debug("debug message", { feature: "debug" });
    logger.info("info message");
    logger.log("log message");
    logger.warn("warn message");
    logger.error("error message");

    expect(consoleSpies.debug).toHaveBeenCalledWith("debug message", {
      feature: "debug",
    });
    expect(consoleSpies.info).toHaveBeenCalledWith("info message");
    expect(consoleSpies.log).toHaveBeenCalledWith("log message");
    expect(consoleSpies.warn).toHaveBeenCalledWith("warn message");
    expect(consoleSpies.error).toHaveBeenCalledWith("error message");
  });

  it("should always output error/warn in production", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");

    logger.warn("warning in production");
    logger.error("error in production");

    expect(consoleSpies.warn).toHaveBeenCalledWith("warning in production");
    expect(consoleSpies.error).toHaveBeenCalledWith("error in production");
  });

  it("should suppress debug/log/info in production by default", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");

    logger.debug("should not log");
    logger.info("should not log");
    logger.log("should not log");

    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).not.toHaveBeenCalled();
    expect(consoleSpies.log).not.toHaveBeenCalled();
  });

  it("should respect LOG_LEVEL=info in production", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("LOG_LEVEL", "info");

    logger.debug("should not log");
    logger.info("should log");
    logger.warn("should log");
    logger.error("should log");

    expect(consoleSpies.debug).not.toHaveBeenCalled();
    expect(consoleSpies.info).toHaveBeenCalledWith("should log");
    expect(consoleSpies.warn).toHaveBeenCalledWith("should log");
    expect(consoleSpies.error).toHaveBeenCalledWith("should log");
  });
});
