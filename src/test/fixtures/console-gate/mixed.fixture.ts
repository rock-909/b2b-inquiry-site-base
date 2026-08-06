import { expect, it } from "vitest";
import { captureExpectedConsoleErrors } from "@/test/console";

it("forwards non-matching errors after capturing an expected one", () => {
  const consoleError = captureExpectedConsoleErrors(
    "console-gate-mixed-expected-sentinel",
  );

  console.error("console-gate-mixed-expected-sentinel");
  console.error("console-gate-mixed-unexpected-sentinel");

  expect(consoleError).toHaveBeenCalledWith(
    "console-gate-mixed-expected-sentinel",
  );
});
