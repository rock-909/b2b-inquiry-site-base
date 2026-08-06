import { expect, it } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";

it("allows an explicitly captured console.error", () => {
  const consoleError = captureExpectedConsoleErrors(
    "console-gate-expected-sentinel",
  );

  console.error("console-gate-expected-sentinel");

  expect(consoleError).toHaveBeenCalledWith("console-gate-expected-sentinel");
});
