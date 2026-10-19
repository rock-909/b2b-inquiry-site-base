import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES_CONFIG } from "@/config/paths/locales-config";

const SCRIPT = path.resolve("scripts/quality/checks/translations.js");
// 脚本按站点配置的语言列表逐个校验；坏值放在最后一个语言里，单语言站点同样成立。
const CHECKED_LOCALE = LOCALES_CONFIG.locales.at(-1) ?? "";

function runCheck(validMessages: unknown, checkedLocaleMessages: unknown) {
  const root = mkdtempSync(path.join(tmpdir(), "translations-check-"));

  for (const locale of LOCALES_CONFIG.locales) {
    const dir = path.join(root, "messages", "base", locale);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    mkdirSync(dir, { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- test fixture path is inside a test-owned temporary directory
    writeFileSync(
      path.join(dir, "messages.json"),
      JSON.stringify(
        locale === CHECKED_LOCALE ? checkedLocaleMessages : validMessages,
      ),
    );
  }

  return spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
}

describe("translations check value types", () => {
  it("accepts string leaves, including intentionally empty strings", () => {
    const messages = { cookie: { rejectAll: "Reject all" }, social: "" };

    const result = runCheck(messages, messages);

    expect(result.status).toBe(0);
  });

  it.each([
    ["a number", 42],
    ["null", null],
    ["an array", ["Reject all"]],
    ["a boolean", true],
  ])("fails and names the locale and path when a value is %s", (_name, bad) => {
    const result = runCheck(
      { cookie: { rejectAll: "Reject all" } },
      { cookie: { rejectAll: bad } },
    );

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `messages/base/${CHECKED_LOCALE}/messages.json`,
    );
    expect(result.stderr).toContain("cookie.rejectAll");
  });
});
