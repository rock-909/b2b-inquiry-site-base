import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = path.resolve("scripts/quality/checks/translations.js");
const tempRoots: string[] = [];

function runCheck(messages: { en: unknown; es: unknown }) {
  const root = mkdtempSync(path.join(tmpdir(), "translations-check-"));
  tempRoots.push(root);

  for (const locale of ["en", "es"] as const) {
    const dir = path.join(root, "messages", "base", locale);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    mkdirSync(dir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    writeFileSync(
      path.join(dir, "messages.json"),
      JSON.stringify(messages[locale]),
    );
  }

  return spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe("translations check value types", () => {
  it("accepts string leaves, including intentionally empty strings", () => {
    const messages = { cookie: { rejectAll: "Reject all" }, social: "" };

    const result = runCheck({ en: messages, es: messages });

    expect(result.status).toBe(0);
  });

  it.each([
    ["a number", 42],
    ["null", null],
    ["an array", ["Reject all"]],
    ["a boolean", true],
  ])("fails and names the locale and path when a value is %s", (_name, bad) => {
    const result = runCheck({
      en: { cookie: { rejectAll: "Reject all" } },
      es: { cookie: { rejectAll: bad } },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("messages/base/es/messages.json");
    expect(result.stderr).toContain("cookie.rejectAll");
  });
});
