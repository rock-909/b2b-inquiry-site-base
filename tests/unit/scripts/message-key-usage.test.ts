import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectMessageKeyUsageFindings } from "../../../scripts/quality/checks/message-key-usage.js";
import { UNUSED_MESSAGE_KEYS } from "../../../scripts/quality/message-key-usage-baseline.js";

type DerivedKeyConsumerFixture = Record<string, unknown> & {
  kind: string;
  file: string;
  reason: string;
};

const tempDirs: string[] = [];
const TEMP_TRASH_ROOT = path.join(
  os.tmpdir(),
  "tucsenberg-message-key-usage-test-trash",
);
const CLIENT_TRANSLATOR_IMPORT = 'import { useTranslations } from "next-intl";';
const SERVER_TRANSLATOR_IMPORT =
  'import { getTranslations } from "next-intl/server";';

function createSource(content: string): { rootDir: string; file: string } {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "message-key-usage-"));
  const file = "src/example.ts";
  const fullPath = path.join(rootDir, file);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.writeFileSync(fullPath, content);
  tempDirs.push(rootDir);
  return { rootDir, file };
}

function createSources(entries: Record<string, string>): {
  rootDir: string;
  files: string[];
} {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "message-key-usage-"));
  const files = Object.keys(entries);
  for (const [file, content] of Object.entries(entries)) {
    const fullPath = path.join(rootDir, file);
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
    fs.writeFileSync(fullPath, content);
  }
  tempDirs.push(rootDir);
  return { rootDir, files };
}

function moveTempDirToTrash(dir: string): void {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup only inspects a test-owned temp directory
  if (!fs.existsSync(dir)) return;
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves fixtures to a recoverable temp trash directory
  fs.mkdirSync(TEMP_TRASH_ROOT, { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves fixtures to a recoverable temp trash directory
  fs.renameSync(
    dir,
    path.join(TEMP_TRASH_ROOT, `${path.basename(dir)}-${Date.now()}`),
  );
}

function collect({
  catalogKeys,
  content = "export {};",
  dynamicPrefixAllowlist = [],
  derivedKeyConsumers = [],
  objectKeyConsumers = [],
  translatorParameterOverrides = [],
  unusedKeyAllowlist = [],
}: {
  catalogKeys: string[];
  content?: string;
  dynamicPrefixAllowlist?: Array<{ prefix: string; reason: string }>;
  derivedKeyConsumers?: DerivedKeyConsumerFixture[];
  objectKeyConsumers?: Array<{
    file: string;
    objectName: string;
    prefix: string;
    reason: string;
  }>;
  translatorParameterOverrides?: Array<{
    file: string;
    functionName: string;
    identifier: string;
    namespace: string;
    reason: string;
  }>;
  unusedKeyAllowlist?: string[];
}) {
  const { rootDir, file } = createSource(content);
  return collectMessageKeyUsageFindings({
    rootDir,
    catalogKeys: new Set(catalogKeys),
    sourceFiles: [file],
    dynamicPrefixAllowlist,
    derivedKeyConsumers,
    objectKeyConsumers,
    translatorParameterOverrides,
    unusedKeyAllowlist,
  });
}

function derivedConsumer(
  config: Record<string, unknown> & { kind: string },
): DerivedKeyConsumerFixture {
  return { file: "src/example.ts", reason: "fixture", ...config };
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    moveTempDirToTrash(tempDir);
  }
});

describe("message key usage gate", () => {
  it("ignores tracked source paths deleted in the current worktree", () => {
    const { rootDir } = createSource("export {};");

    expect(
      collectMessageKeyUsageFindings({
        rootDir,
        catalogKeys: new Set(),
        sourceFiles: ["src/deleted-component.test.tsx"],
        dynamicPrefixAllowlist: [],
        derivedKeyConsumers: [],
        objectKeyConsumers: [],
        translatorParameterOverrides: [],
        unusedKeyAllowlist: [],
      }),
    ).toEqual([]);
  });

  it("keeps the unused-key baseline empty after dynamic consumers are registered", () => {
    expect(UNUSED_MESSAGE_KEYS).toEqual([]);
  });

  it("accepts a statically consumed catalog key", () => {
    expect(
      collect({
        catalogKeys: ["example.used"],
        content: [
          CLIENT_TRANSLATOR_IMPORT,
          'const t = useTranslations("example");',
          'export const value = t("used");',
        ].join("\n"),
      }),
    ).toEqual([]);

    expect(
      collect({
        catalogKeys: ["example.used"],
        content: [
          CLIENT_TRANSLATOR_IMPORT,
          'const KEY = "used";',
          'const t = useTranslations("example");',
          "export const value = t(KEY);",
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("does not resolve imported keys from unrelated same-name constants", () => {
    const { rootDir, files } = createSources({
      "src/a.ts": [
        CLIENT_TRANSLATOR_IMPORT,
        'import { KEY } from "./runtime";',
        'const t = useTranslations("example");',
        "export const value = t(KEY);",
      ].join("\n"),
      "src/runtime.ts": "export const KEY = getRuntimeKey();",
      "src/b.ts": 'const KEY = "used";',
    });

    expect(
      collectMessageKeyUsageFindings({
        rootDir,
        catalogKeys: new Set(["example.used"]),
        sourceFiles: files,
        dynamicPrefixAllowlist: [],
        derivedKeyConsumers: [],
        objectKeyConsumers: [],
        translatorParameterOverrides: [],
        unusedKeyAllowlist: [],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error: 'dynamic message key prefix is not allowlisted "example."',
    });
  });

  it("rejects a used key that is missing from the catalog", () => {
    expect(
      collect({
        catalogKeys: ["other.missing"],
        content: [
          CLIENT_TRANSLATOR_IMPORT,
          'const t = useTranslations("example");',
          'export const value = t("missing");',
        ].join("\n"),
      }),
    ).toContainEqual({
      file: "message usage",
      error: 'used message key is missing from the catalog "example.missing"',
    });
  });

  it("rejects an unused key unless its exact leaf is baselined", () => {
    expect(collect({ catalogKeys: ["example.dead"] })).toEqual([
      {
        file: "messages",
        error:
          'message key has no detected consumer and is not baselined "example.dead"',
      },
    ]);
    expect(
      collect({
        catalogKeys: ["example.dead"],
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);
  });

  it("does not count a matching bare string as a message consumer", () => {
    expect(
      collect({
        catalogKeys: ["example.dead"],
        content: 'export const fixture = "example.dead";',
      }),
    ).toContainEqual({
      file: "messages",
      error:
        'message key has no detected consumer and is not baselined "example.dead"',
    });
  });

  it("rejects stale unused baselines after deletion or new consumption", () => {
    expect(
      collect({
        catalogKeys: [],
        unusedKeyAllowlist: ["example.deleted"],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'unused message key baseline is stale because the key is absent "example.deleted"',
    });

    expect(
      collect({
        catalogKeys: ["example.used"],
        content: [
          CLIENT_TRANSLATOR_IMPORT,
          'const t = useTranslations("example");',
          'export const value = t("used");',
        ].join("\n"),
        unusedKeyAllowlist: ["example.used"],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'unused message key baseline is stale because the key is now consumed "example.used"',
    });
  });

  it("requires dynamic prefixes to be registered and rejects stale entries", () => {
    const content = [
      CLIENT_TRANSLATOR_IMPORT,
      'const t = useTranslations("example");',
      "export const value = (key: string) => t(`items.${key}`);",
    ].join("\n");
    expect(
      collect({ catalogKeys: ["example.items.one"], content }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error: 'dynamic message key prefix is not allowlisted "example.items."',
    });

    expect(
      collect({
        catalogKeys: ["example.items.one", "example.items.deadSibling"],
        content,
        dynamicPrefixAllowlist: [
          { prefix: "example.items.", reason: "fixture" },
        ],
        unusedKeyAllowlist: ["example.items.one"],
      }),
    ).toContainEqual({
      file: "messages",
      error:
        'message key has no detected consumer and is not baselined "example.items.deadSibling"',
    });

    expect(
      collect({
        catalogKeys: ["example.other"],
        dynamicPrefixAllowlist: [
          { prefix: "example.items.", reason: "fixture" },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'dynamic message key prefix matches no catalog key "example.items."',
    });

    expect(
      collect({
        catalogKeys: ["example.items.one"],
        dynamicPrefixAllowlist: [
          { prefix: "example.items.", reason: "fixture" },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'dynamic message key prefix is stale because no consumer emits it "example.items."',
    });
  });
});

describe("derived message key consumers", () => {
  it("derives exact keys from configured copy objects", () => {
    expect(
      collect({
        catalogKeys: ["example.title", "example.unused"],
        content:
          'const COPY = { title: "Title" } satisfies Record<string, string>;',
        objectKeyConsumers: [
          {
            file: "src/example.ts",
            objectName: "COPY",
            prefix: "example.",
            reason: "fixture",
          },
        ],
        unusedKeyAllowlist: ["example.unused"],
      }),
    ).toEqual([]);
  });

  it("filters configured collection values with runtime entry rules", () => {
    expect(
      collect({
        catalogKeys: ["form.active", "form.disabled", "form.activePlaceholder"],
        content: [
          "const FIELDS = {",
          '  active: { enabled: true, type: "text", i18nKey: "active" },',
          '  disabled: { enabled: false, type: "tel", i18nKey: "disabled" },',
          "};",
          'const PLACEHOLDERS = { active: "activePlaceholder", disabled: "disabledPlaceholder" };',
        ].join("\n"),
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "collection-values",
            sourceName: "FIELDS",
            valueProperty: "i18nKey",
            entryFilters: [{ property: "enabled", equals: true }],
            prefix: "form.",
            suffixes: [""],
          }),
          derivedConsumer({
            kind: "collection-values",
            sourceName: "PLACEHOLDERS",
            entryKeySource: {
              sourceName: "FIELDS",
              filters: [{ property: "enabled", equals: true }],
            },
            prefix: "form.",
            suffixes: [""],
          }),
        ],
        unusedKeyAllowlist: ["form.disabled"],
      }),
    ).toEqual([]);
  });

  it("derives the runtime string values of finite error domains", () => {
    expect(
      collect({
        catalogKeys: ["apiErrors.RENAMED_AT_RUNTIME"],
        content: 'const CODES = ["RENAMED_AT_RUNTIME"] as const;',
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "collection-values",
            sourceName: "CODES",
            prefix: "apiErrors.",
            suffixes: [""],
          }),
        ],
      }),
    ).toEqual([]);

    expect(
      collect({
        catalogKeys: ["apiErrors.FAILED"],
        content: 'const CODES = ["RENAMED_AT_RUNTIME"] as const;',
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "collection-values",
            sourceName: "CODES",
            prefix: "apiErrors.",
            suffixes: [""],
          }),
        ],
        unusedKeyAllowlist: ["apiErrors.FAILED"],
      }),
    ).toContainEqual({
      file: "message usage",
      error:
        'used message key is missing from the catalog "apiErrors.RENAMED_AT_RUNTIME"',
    });
  });

  it("rejects stale configured object consumers", () => {
    expect(
      collect({
        catalogKeys: [],
        objectKeyConsumers: [
          {
            file: "src/example.ts",
            objectName: "REMOVED_COPY",
            prefix: "example.",
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'message object-key consumer is stale "src/example.ts#REMOVED_COPY"',
    });
  });

  it("derives only exact collection keys and detects missing required leaves", () => {
    const consumer = derivedConsumer({
      kind: "collection-values",
      sourceName: "ITEM_KEYS",
      prefix: "example.items.",
      suffixes: [".title"],
    });
    expect(
      collect({
        catalogKeys: ["example.items.one.title", "example.items.dead.title"],
        content: 'const ITEM_KEYS = ["one"] as const;',
        derivedKeyConsumers: [consumer],
        unusedKeyAllowlist: ["example.items.dead.title"],
      }),
    ).toEqual([]);

    expect(
      collect({
        catalogKeys: [],
        content: 'const ITEM_KEYS = ["one"] as const;',
        derivedKeyConsumers: [consumer],
      }),
    ).toContainEqual({
      file: "message usage",
      error:
        'used message key is missing from the catalog "example.items.one.title"',
    });
  });

  it("does not let a property-access root hide an unaccessed sibling", () => {
    expect(
      collect({
        catalogKeys: ["example.used", "example.deadSibling"],
        content: [
          "const copy = messages.example;",
          "function Other() {",
          "  const copy = messages.example;",
          "  return copy.deadSibling;",
          "}",
          "export const value = copy.used;",
        ].join("\n"),
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "property-accesses",
            rootName: "copy",
            prefix: "example.",
          }),
        ],
        unusedKeyAllowlist: ["example.deadSibling"],
      }),
    ).toEqual([]);
  });

  it("rejects stale derived consumers when their declaration disappears", () => {
    expect(
      collect({
        catalogKeys: [],
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "collection-values",
            sourceName: "REMOVED_KEYS",
            prefix: "example.",
            suffixes: [""],
          }),
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is stale "src/example.ts#collection-values"',
    });
  });

  it("follows one-argument translator forwarding helpers", () => {
    expect(
      collect({
        catalogKeys: ["example.used"],
        content: [
          CLIENT_TRANSLATOR_IMPORT,
          'const t = useTranslations("example");',
          "const translate = (key: string) => t(key as never);",
          'export const value = translate("used");',
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("detects translators destructured from Promise.all", () => {
    expect(
      collect({
        catalogKeys: ["example.used"],
        content: [
          SERVER_TRANSLATOR_IMPORT,
          "const [t, data] = await Promise.all([",
          '  getTranslations({ namespace: "example" }),',
          "  loadData(),",
          "]);",
          'export const value = t("used");',
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("does not confuse a shadowing callback parameter with an outer translator", () => {
    expect(
      collect({
        catalogKeys: ["metadata.title"],
        content: [
          CLIENT_TRANSLATOR_IMPORT,
          'const t = useTranslations("metadata");',
          "function Aside({ t }: { t: (key: string) => string }) {",
          '  return t("heading");',
          "}",
          'export const title = t("title");',
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("does not count a shadowing local variable as an outer translator", () => {
    expect(
      collect({
        catalogKeys: ["example.used", "example.dead"],
        content: [
          CLIENT_TRANSLATOR_IMPORT,
          'const t = useTranslations("example");',
          "function ordinaryFunction(key: string) { return key; }",
          "function Nested() {",
          "  const t = ordinaryFunction;",
          '  return t("dead");',
          "}",
          'export const value = [t("used"), Nested()];',
        ].join("\n"),
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);
  });

  it("does not count an imported same-name function as a nested translator", () => {
    expect(
      collect({
        catalogKeys: ["example.used", "example.dead"],
        content: [
          CLIENT_TRANSLATOR_IMPORT,
          'import { t } from "./ordinary";',
          'export const ordinary = t("dead");',
          "export function Example() {",
          '  const t = useTranslations("example");',
          '  return t("used");',
          "}",
        ].join("\n"),
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);
  });

  it("accepts aliased and namespace imports from next-intl", () => {
    expect(
      collect({
        catalogKeys: ["example.first", "example.second"],
        content: [
          'import { useTranslations as useT } from "next-intl";',
          'import * as intl from "next-intl";',
          'const first = useT("example");',
          'const second = intl.useTranslations("example");',
          'export const value = [first("first"), second("second")];',
        ].join("\n"),
      }),
    ).toEqual([]);
  });

  it("rejects fake translation factories with matching names", () => {
    const fixtures = [
      [
        "function useTranslations() { return (key: string) => key; }",
        'const t = useTranslations("example");',
        'export const value = t("dead");',
      ],
      [
        'import { useTranslations } from "./ordinary";',
        'const t = useTranslations("example");',
        'export const value = t("dead");',
      ],
      [
        "const intl = { useTranslations: () => (key: string) => key };",
        'const t = intl.useTranslations("example");',
        'export const value = t("dead");',
      ],
    ];

    for (const content of fixtures) {
      expect(
        collect({
          catalogKeys: ["example.dead"],
          content: content.join("\n"),
          unusedKeyAllowlist: ["example.dead"],
        }),
      ).toEqual([]);
    }
  });

  it("scopes translator parameter overrides to the declared function", () => {
    expect(
      collect({
        catalogKeys: ["apiErrors.used", "apiErrors.dead"],
        content: [
          "export function Translated(tApi: (key: string) => string) {",
          '  return tApi("used");',
          "}",
          "export function Ordinary(tApi: (key: string) => string) {",
          '  return tApi("dead");',
          "}",
        ].join("\n"),
        translatorParameterOverrides: [
          {
            file: "src/example.ts",
            functionName: "Translated",
            identifier: "tApi",
            namespace: "apiErrors",
            reason: "fixture",
          },
        ],
        unusedKeyAllowlist: ["apiErrors.dead"],
      }),
    ).toEqual([]);
  });

  it("rejects a stale translator parameter override", () => {
    expect(
      collect({
        catalogKeys: [],
        translatorParameterOverrides: [
          {
            file: "src/example.ts",
            functionName: "Removed",
            identifier: "t",
            namespace: "example",
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'translator parameter override is stale "src/example.ts#Removed:t"',
    });
  });

  it("rejects an ambiguous translator parameter override", () => {
    expect(
      collect({
        catalogKeys: [],
        content: [
          "function Translated(t: (key: string) => string) { return t; }",
          "function Translated(t: (key: string) => string) { return t; }",
        ].join("\n"),
        translatorParameterOverrides: [
          {
            file: "src/example.ts",
            functionName: "Translated",
            identifier: "t",
            namespace: "example",
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'translator parameter override is ambiguous "src/example.ts#Translated:t"',
    });
  });

  it("binds derived call consumers to one declaration symbol", () => {
    expect(
      collect({
        catalogKeys: ["example.used"],
        content: [
          "function Example() {",
          "  const translate = (key: string) => key;",
          '  return translate("used");',
          "}",
        ].join("\n"),
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "call-arguments",
            ownerFunction: "Example",
            callee: "translate",
            prefixes: ["example."],
          }),
        ],
      }),
    ).toEqual([]);

    expect(
      collect({
        catalogKeys: [],
        content: [
          "function Example() {",
          "  const translate = (key: string) => key;",
          "  const translate = (key: string) => key;",
          "  return translate;",
          "}",
        ].join("\n"),
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "call-arguments",
            ownerFunction: "Example",
            callee: "translate",
            prefixes: ["example."],
          }),
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is ambiguous "src/example.ts#call-arguments"',
    });

    expect(
      collect({
        catalogKeys: [],
        content: [
          "function Example() { return null; }",
          "function Other() {",
          "  const translate = (key: string) => key;",
          '  return translate("dead");',
          "}",
        ].join("\n"),
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "call-arguments",
            ownerFunction: "Example",
            callee: "translate",
            prefixes: ["example."],
          }),
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is stale "src/example.ts#call-arguments"',
    });
  });

  it("uses one unique top-level collection declaration", () => {
    expect(
      collect({
        catalogKeys: ["example.used", "example.dead"],
        content: [
          'const KEYS = ["used"] as const;',
          "function Other() {",
          '  const KEYS = ["dead"] as const;',
          "  return KEYS;",
          "}",
        ].join("\n"),
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "collection-values",
            sourceName: "KEYS",
            prefix: "example.",
            suffixes: [""],
          }),
        ],
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);

    expect(
      collect({
        catalogKeys: [],
        content: [
          "function Other() {",
          '  const KEYS = ["dead"] as const;',
          "  return KEYS;",
          "}",
        ].join("\n"),
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "collection-values",
            sourceName: "KEYS",
            prefix: "example.",
            suffixes: [""],
          }),
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is stale "src/example.ts#collection-values"',
    });

    expect(
      collect({
        catalogKeys: [],
        content: [
          "const KEYS = [] as const;",
          "const KEYS = [] as const;",
        ].join("\n"),
        derivedKeyConsumers: [
          derivedConsumer({
            kind: "collection-values",
            sourceName: "KEYS",
            prefix: "example.",
            suffixes: [""],
          }),
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is ambiguous "src/example.ts#collection-values"',
    });
  });
});
