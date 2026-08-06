import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

const ESLINT_CONFIG_PATH = path.resolve("eslint.config.mjs");
const STRUCTURAL_SCRIPT_RULES = [
  "complexity",
  "max-depth",
  "max-lines",
  "max-lines-per-function",
  "max-nested-callbacks",
  "max-params",
  "max-statements",
] as const;

interface EslintConfigBlock {
  files?: string[];
  ignores?: string[];
  name?: string;
  rules?: Record<string, unknown>;
}

/**
 * 仓库自己写的配置块。第三方 preset（`@eslint/js/recommended`、
 * `typescript-eslint/recommended` 之类）名字里带 `/`，覆盖它们是正常做法，
 * 不参与下面的重复检测。
 */
function isRepoAuthored(block: EslintConfigBlock): boolean {
  return /^[a-z][a-z0-9-]*$/u.test(block.name ?? "");
}

/**
 * 一个块的作用域：files 和 ignores 一起，glob 排序后比较。
 *
 * ignores 必须算进来——files 相同、ignores 不同是两个不同的作用域，前一个
 * 块在被后一个排除掉的文件上照样生效。漏掉它会把真防线报成重复声明。
 */
function scopeKey(block: EslintConfigBlock): string {
  const sorted = (globs?: string[]) => [...(globs ?? [])].sort();

  return JSON.stringify({
    files: block.files ? sorted(block.files) : "ALL_FILES",
    ignores: sorted(block.ignores),
  });
}

async function loadEslintConfig(): Promise<EslintConfigBlock[]> {
  const moduleUrl = `${pathToFileURL(ESLINT_CONFIG_PATH).href}?test=${Date.now()}`;
  const configModule = (await import(moduleUrl)) as {
    default: EslintConfigBlock[];
  };

  return configModule.default;
}

function findNamedBlock(
  config: EslintConfigBlock[],
  name: string,
): EslintConfigBlock {
  const block = config.find((item) => item.name === name);

  expect(block, `Expected ESLint config block "${name}"`).toBeDefined();
  return block!;
}

function expectWarningLevel(ruleName: string, value: unknown): void {
  if (Array.isArray(value)) {
    expect(value[0], `${ruleName} should be warning-level`).toBe("warn");
    return;
  }

  expect(value, `${ruleName} should be warning-level`).toBe("warn");
}

describe("eslint config governance", () => {
  it("uses the TypeScript-aware unused-expression rule without duplicate reports", async () => {
    const config = await loadEslintConfig();
    const overrides = findNamedBlock(config, "ts-core-overrides");

    expect(overrides.rules?.["no-unused-expressions"]).toBe("off");
  });

  it("uses one shared magic-number ignore list in the strict quality block", () => {
    const source = fs.readFileSync(ESLINT_CONFIG_PATH, "utf8");

    expect(source).toContain("const MAGIC_NUMBER_IGNORE_LIST = [");
    expect(source.match(/"no-magic-numbers": \[/gu) ?? []).toHaveLength(1);
    expect(
      source.match(/ignore: MAGIC_NUMBER_IGNORE_LIST/gu) ?? [],
    ).toHaveLength(1);
  });

  it("keeps structural script rules at warning level before final overrides", async () => {
    const config = await loadEslintConfig();
    const scriptsBlock = findNamedBlock(config, "scripts-and-dev-tools");
    const rules = scriptsBlock.rules ?? {};

    for (const ruleName of STRUCTURAL_SCRIPT_RULES) {
      expect(rules[ruleName], `${ruleName} should be configured`).toBeDefined();
      expectWarningLevel(ruleName, rules[ruleName]);
    }
  });

  it("does not disable structural script rules in the final scripts override", async () => {
    const config = await loadEslintConfig();
    const scriptsOverride = findNamedBlock(
      config,
      "scripts-directory-overrides",
    );
    const rules = scriptsOverride.rules ?? {};

    for (const ruleName of STRUCTURAL_SCRIPT_RULES) {
      expect(rules[ruleName], `${ruleName} must not be turned off`).not.toBe(
        "off",
      );
    }
  });

  // 同一作用域重复设置规则会让前一个配置块失效。作用域包含 files 和 ignores，
  // glob 顺序不影响等价性；不同宽度的 glob 不在这条检查的判断范围内。
  it("never lets one block silently replace another at the identical files scope", async () => {
    const config = await loadEslintConfig();
    const seen = new Map<string, string>();
    const shadowed: string[] = [];

    for (const block of config) {
      if (!isRepoAuthored(block) || !block.rules) continue;

      const scope = scopeKey(block);
      for (const rule of Object.keys(block.rules)) {
        const key = `${scope}::${rule}`;
        const earlier = seen.get(key);

        if (earlier) {
          shadowed.push(`${rule} @ ${scope}: ${earlier} → ${block.name}`);
        }
        seen.set(key, block.name ?? "(unnamed)");
      }
    }

    expect(shadowed).toEqual([]);
  });

  // ignores 不同代表规则适用范围不同。
  it("does not call two blocks the same scope when only their ignores differ", () => {
    const wide = {
      name: "wide",
      files: ["**/*.ts"],
      rules: { "no-eval": "error" },
    };
    const narrowed = {
      name: "narrowed",
      files: ["**/*.ts"],
      ignores: ["scripts/**"],
      rules: { "no-eval": "off" },
    };

    expect(scopeKey(wide)).not.toBe(scopeKey(narrowed));
  });

  it("calls two blocks the same scope when their globs differ only in order", () => {
    expect(scopeKey({ name: "a", files: ["**/*.ts", "**/*.tsx"] })).toBe(
      scopeKey({ name: "b", files: ["**/*.tsx", "**/*.ts"] }),
    );
  });

  it("keeps script baselines file-specific instead of directory-wide", async () => {
    const config = await loadEslintConfig();
    const scriptBaseline = findNamedBlock(
      config,
      "script-structural-baselines",
    );

    expect(scriptBaseline.files).toEqual([
      "scripts/quality/checks/content-readiness.js",
      "scripts/quality/checks/content-slugs.js",
      "scripts/quality/checks/release-verify.js",
    ]);

    for (const value of Object.values(scriptBaseline.rules ?? {})) {
      expect(Array.isArray(value) ? value[0] : value).toBe("warn");
    }
  });
});
