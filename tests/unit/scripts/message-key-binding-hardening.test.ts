import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collectMessageKeyUsageFindings } from "../../../scripts/quality/checks/message-key-usage.js";

type DerivedKeyConsumerFixture = Record<string, unknown> & {
  kind: string;
  file: string;
  reason: string;
};

const tempDirs: string[] = [];
const TEMP_TRASH_ROOT = path.join(
  os.tmpdir(),
  "tucsenberg-message-binding-test-trash",
);

function collect({
  catalogKeys = [],
  content,
  derivedKeyConsumers = [],
  objectKeyConsumers = [],
  translatorParameterOverrides = [],
  unusedKeyAllowlist = [],
}: {
  catalogKeys?: string[];
  content: string;
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
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "message-binding-"));
  const file = "src/example.ts";
  const fullPath = path.join(rootDir, file);
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixture path stays inside the test-owned temp directory
  fs.writeFileSync(fullPath, content);
  tempDirs.push(rootDir);
  return collectMessageKeyUsageFindings({
    rootDir,
    catalogKeys: new Set(catalogKeys),
    sourceFiles: [file],
    dynamicPrefixAllowlist: [],
    derivedKeyConsumers,
    objectKeyConsumers,
    translatorParameterOverrides,
    unusedKeyAllowlist,
  });
}

afterEach(() => {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves fixtures to a recoverable temp trash directory
  fs.mkdirSync(TEMP_TRASH_ROOT, { recursive: true });
  for (const dir of tempDirs.splice(0)) {
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup only inspects a test-owned temp directory
    if (!fs.existsSync(dir)) continue;
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- cleanup moves fixtures to a recoverable temp trash directory
    fs.renameSync(
      dir,
      path.join(TEMP_TRASH_ROOT, `${path.basename(dir)}-${Date.now()}`),
    );
  }
});

describe("message key binding hardening", () => {
  it("accepts only the project readRequiredMessagePath import", () => {
    expect(
      collect({
        catalogKeys: ["example.used"],
        content: [
          'import { readRequiredMessagePath as readPath } from "@/lib/i18n/read-message-path";',
          "const messages = {};",
          'export const value = readPath(messages, ["example", "used"]);',
        ].join("\n"),
      }),
    ).toEqual([]);

    const fakeReaders = [
      [
        "function readRequiredMessagePath(_messages: unknown, path: string[]) { return path; }",
        'readRequiredMessagePath({}, ["example", "dead"]);',
      ],
      [
        'import { readRequiredMessagePath } from "./ordinary";',
        'readRequiredMessagePath({}, ["example", "dead"]);',
      ],
      [
        "const reader = { readRequiredMessagePath: (_messages: unknown, path: string[]) => path };",
        'reader.readRequiredMessagePath({}, ["example", "dead"]);',
      ],
    ];
    for (const content of fakeReaders) {
      expect(
        collect({
          catalogKeys: ["example.dead"],
          content: content.join("\n"),
          unusedKeyAllowlist: ["example.dead"],
        }),
      ).toEqual([]);
    }
  });

  it("requires one unique top-level object-key source", () => {
    const consumer = {
      file: "src/example.ts",
      objectName: "COPY",
      prefix: "example.",
      reason: "fixture",
    };
    expect(
      collect({
        catalogKeys: ["example.used", "example.dead"],
        content: [
          'const COPY = { used: "Used" };',
          'function Other() { const COPY = { dead: "Dead" }; return COPY; }',
        ].join("\n"),
        objectKeyConsumers: [consumer],
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);

    expect(
      collect({
        content:
          'function Other() { const COPY = { dead: "Dead" }; return COPY; }',
        objectKeyConsumers: [consumer],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error: 'message object-key consumer is stale "src/example.ts#COPY"',
    });

    expect(
      collect({
        content: ["const COPY = {};", "const COPY = {};"].join("\n"),
        objectKeyConsumers: [consumer],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error: 'message object-key consumer is ambiguous "src/example.ts#COPY"',
    });
  });

  it("does not treat a shadowed Promise.all as translator construction", () => {
    expect(
      collect({
        catalogKeys: ["example.dead"],
        content: [
          'import { getTranslations } from "next-intl/server";',
          "const Promise = { all: (values: unknown[]) => values };",
          'const [t] = Promise.all([getTranslations("example")]);',
          'export const value = t("dead");',
        ].join("\n"),
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);
  });

  it("does not trust mutable translator or message-key bindings", () => {
    expect(
      collect({
        catalogKeys: ["example.dead"],
        content: [
          'import { useTranslations } from "next-intl";',
          'let t = useTranslations("example");',
          "t = ((key: string) => key) as typeof t;",
          'export const value = t("dead");',
        ].join("\n"),
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);

    expect(
      collect({
        catalogKeys: ["example.dead"],
        content: [
          'import { useTranslations } from "next-intl";',
          'const t = useTranslations("example");',
          'let key = "dead";',
          'key = "other";',
          "export const value = t(key);",
        ].join("\n"),
        unusedKeyAllowlist: ["example.dead"],
      }).map((finding) => finding.error),
    ).toContain('dynamic message key prefix is not allowlisted "example."');
  });

  it("fails closed on dynamic translator namespaces and message paths", () => {
    expect(
      collect({
        content: [
          'import { useTranslations } from "next-intl";',
          "declare const namespace: string;",
          "const t = useTranslations(namespace);",
          'export const value = t("dead");',
        ].join("\n"),
      }).map((finding) => finding.error),
    ).toContain('dynamic message key prefix is not allowlisted "<unknown>"');

    expect(
      collect({
        content: [
          'import { readRequiredMessagePath } from "@/lib/i18n/read-message-path";',
          "declare const path: string[];",
          "export const value = readRequiredMessagePath({}, path);",
        ].join("\n"),
      }).map((finding) => finding.error),
    ).toContain('dynamic message key prefix is not allowlisted "<unknown>"');
  });

  it("limits parameter overrides to top-level function owners", () => {
    const override = {
      file: "src/example.ts",
      functionName: "Translated",
      identifier: "t",
      namespace: "example",
      reason: "fixture",
    };
    expect(
      collect({
        catalogKeys: ["example.used", "example.dead"],
        content: [
          'function Translated(t: (key: string) => string) { return t("used"); }',
          "function Outer() {",
          '  function Translated(t: (key: string) => string) { return t("dead"); }',
          "  return Translated;",
          "}",
        ].join("\n"),
        translatorParameterOverrides: [override],
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);

    expect(
      collect({
        content: [
          "function Outer() {",
          "  function Translated(t: (key: string) => string) { return t; }",
          "  return Translated;",
          "}",
        ].join("\n"),
        translatorParameterOverrides: [override],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'translator parameter override is stale "src/example.ts#Translated:t"',
    });
  });

  it("binds collection consumers to their unique top-level source", () => {
    expect(
      collect({
        catalogKeys: ["example.used", "example.dead"],
        content: [
          'const KEYS = { primary: "used" };',
          'function Config() { const KEYS = { nested: "dead" }; return KEYS; }',
        ].join("\n"),
        derivedKeyConsumers: [
          {
            kind: "collection-values",
            file: "src/example.ts",
            sourceName: "KEYS",
            prefix: "example.",
            suffixes: [""],
            reason: "fixture",
          },
        ],
        unusedKeyAllowlist: ["example.dead"],
      }),
    ).toEqual([]);
  });

  it("filters array descriptors before deriving configured values", () => {
    expect(
      collect({
        catalogKeys: ["example.active.badge", "example.inactive.badge"],
        content:
          'const ITEMS = [{ key: "active", hasBadge: true }, { key: "inactive" }] as const;',
        derivedKeyConsumers: [
          {
            kind: "collection-values",
            file: "src/example.ts",
            sourceName: "ITEMS",
            valueProperty: "key",
            entryFilters: [{ property: "hasBadge", equals: true }],
            prefix: "example.",
            suffixes: [".badge"],
            reason: "fixture",
          },
        ],
        unusedKeyAllowlist: ["example.inactive.badge"],
      }),
    ).toEqual([]);
  });

  it("rejects partial derived and object-key sources it cannot enumerate", () => {
    expect(
      collect({
        content: [
          'const EXTRA = { dead: "Dead" };',
          'const COPY = { used: "Used", ...EXTRA };',
        ].join("\n"),
        objectKeyConsumers: [
          {
            file: "src/example.ts",
            objectName: "COPY",
            prefix: "example.",
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error: 'message object-key consumer is unsupported "src/example.ts#COPY"',
    });

    expect(
      collect({
        content: [
          'const EXTRA = ["dead"];',
          'const KEYS = ["used", ...EXTRA];',
        ].join("\n"),
        derivedKeyConsumers: [
          {
            kind: "collection-values",
            file: "src/example.ts",
            sourceName: "KEYS",
            prefix: "example.",
            suffixes: [""],
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is unsupported "src/example.ts#collection-values"',
    });

    expect(
      collect({
        content: 'let KEYS = ["used"]; KEYS = ["dead"];',
        derivedKeyConsumers: [
          {
            kind: "collection-values",
            file: "src/example.ts",
            sourceName: "KEYS",
            prefix: "example.",
            suffixes: [""],
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is unsupported "src/example.ts#collection-values"',
    });
  });

  it("rejects dynamic values on configured derived consumer paths", () => {
    expect(
      collect({
        content: [
          "function Footer() {",
          "  const translateWithFallback = (key: string) => key;",
          '  translateWithFallback("used");',
          "  translateWithFallback(getKey());",
          "}",
        ].join("\n"),
        derivedKeyConsumers: [
          {
            kind: "call-arguments",
            file: "src/example.ts",
            ownerFunction: "Footer",
            callee: "translateWithFallback",
            prefixes: ["example."],
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is unsupported "src/example.ts#call-arguments"',
    });

    expect(
      collect({
        content: [
          "declare const labelKey: string;",
          'const ITEMS = { active: { enabled: true, labelKey }, disabled: { enabled: false, labelKey: "ignored" } };',
        ].join("\n"),
        derivedKeyConsumers: [
          {
            kind: "collection-values",
            file: "src/example.ts",
            sourceName: "ITEMS",
            valueProperty: "labelKey",
            entryFilters: [{ property: "enabled", equals: true }],
            prefix: "example.",
            suffixes: [""],
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is unsupported "src/example.ts#collection-values"',
    });
  });

  it("rejects dynamic element access on configured property roots", () => {
    expect(
      collect({
        content: [
          'const emailTemplateCopy = { subject: "Subject" };',
          "declare const key: string;",
          "export const known = emailTemplateCopy.subject;",
          "export const dynamic = emailTemplateCopy[key];",
        ].join("\n"),
        derivedKeyConsumers: [
          {
            kind: "property-accesses",
            file: "src/example.ts",
            rootName: "emailTemplateCopy",
            prefix: "emailTemplates.",
            reason: "fixture",
          },
        ],
      }),
    ).toContainEqual({
      file: "scripts/quality/message-key-usage-baseline.js",
      error:
        'derived message key consumer is unsupported "src/example.ts#property-accesses"',
    });
  });
});
