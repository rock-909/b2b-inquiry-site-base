const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");

const ROOT = process.cwd();

function toRepoPath(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

function getLineNumber(content, index) {
  return content.slice(0, index).split("\n").length;
}

const LOGO_REFERENCE = "/images/logo.svg";
const LOGO_ASSET_PATH = "public/images/logo.svg";
const MARKDOWN_LOGO_REFERENCE_PATTERN =
  /!?\[[^\]]*\]\(\s*<?\/images\/logo\.svg>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\)/iu;
const ATTRIBUTE_LOGO_REFERENCE_PATTERN =
  /\b(?:href|src)\s*=\s*(?:"\/images\/logo\.svg"|'\/images\/logo\.svg'|\{\s*(?:"\/images\/logo\.svg"|'\/images\/logo\.svg'|`\/images\/logo\.svg`)\s*\})/iu;
const TUCSENBERG_PRODUCT_PAGE_PREFIX = "src/constants/tucsenberg-product-page-";
const TUCSENBERG_PRODUCT_PAGES_PATH =
  "src/constants/tucsenberg-product-pages.ts";
const READINESS_SCAN_TARGETS = [
  {
    root: "content/pages",
    extensions: new Set([".mdx"]),
    scanTextRules: true,
  },
  {
    root: "messages",
    extensions: new Set([".json"]),
    allowedPathPattern:
      /^messages\/(?:base\/[^/]+|profiles\/(?:b2b-lead|catalog)\/[^/]+)\/messages\.json$/u,
    scanTextRules: true,
  },
  {
    root: "public/images",
    extensions: new Set([
      ".avif",
      ".gif",
      ".jpg",
      ".jpeg",
      ".png",
      ".svg",
      ".webp",
    ]),
    scanTextRules: false,
    scanPathRules: true,
  },
  {
    root: "src/constants",
    extensions: new Set([".js", ".json", ".mjs", ".ts", ".tsx"]),
    allowedPath: (repoPath) =>
      (repoPath.startsWith(TUCSENBERG_PRODUCT_PAGE_PREFIX) ||
        repoPath === TUCSENBERG_PRODUCT_PAGES_PATH) &&
      repoPath.endsWith(".ts"),
    scanTextRules: true,
  },
  {
    root: "src/config",
    extensions: new Set([".ts"]),
    allowedPathPattern:
      /^src\/config\/(?:single-site|single-site-seo|single-site-navigation|single-site-links|single-site-page-expression|single-site-product-catalog)\.ts$/u,
    scanTextRules: true,
  },
];
const GENERATED_DIR_NAMES = new Set([
  ".git",
  ".next",
  ".open-next",
  ".wrangler",
  "coverage",
  "dist",
  "generated",
  "node_modules",
  "reports",
  "storybook-static",
]);
const EXCLUDED_FILE_PATTERN =
  /(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)|\.(?:test|spec)\.[^.]+$/u;
const TEXT_RULES = [
  {
    ruleId: "starter-identity",
    severity: "warning",
    pattern:
      /\b(?:Showcase Website Starter|Public Demo Starter Site|Reusable Showcase Website Starter|Showcase Website Starter Team)\b/giu,
    message:
      "Starter site identity is still present. Replace it before client launch.",
  },
  {
    ruleId: "fake-phone",
    severity: "error",
    pattern:
      /(?:\+?1[\s.-]?)?(?:(?:\(?555\)?[\s.-]?\d{3})|(?:\(?\d{3}\)?[\s.-]?555))[\s.-]?\d{4}\b|\b123[\s.-]?456[\s.-]?7890\b/giu,
    message: "Fake phone marker is present in buyer-visible content.",
  },
  {
    ruleId: "sample-product",
    severity: "warning",
    pattern: /\bsample(?:[\s_-]+)product\b/giu,
    message:
      "Starter sample product text is still present. Replace it before launch.",
  },
  {
    ruleId: "replaceable-content",
    severity: "warning",
    pattern: /\breplaceable catalog example\b|\breplace with real\b/giu,
    message:
      "Replaceable starter catalog content is still present. Replace it before client launch.",
  },
  {
    ruleId: "example-standard",
    severity: "warning",
    pattern: /\bExample Standard [A-Z]\b/gu,
    message:
      "Example standard marker is still present in catalog truth. Replace it before client launch.",
  },
  {
    ruleId: "example-offer",
    severity: "warning",
    pattern:
      /\b(?:Primary|Secondary|Regional|Platform|Specialty) Offer Example\b/gu,
    message:
      "Example offer marker is still present in catalog truth. Replace it before client launch.",
  },
  {
    ruleId: "replace-this-image",
    severity: "warning",
    pattern: /\breplace this image\b/giu,
    message:
      "Image replacement placeholder is still present. Replace it before launch.",
  },
  {
    ruleId: "todo-marker",
    severity: "error",
    pattern: /\bTODO\b/gu,
    message: "TODO marker is present in buyer-visible content.",
  },
  {
    ruleId: "lorem-ipsum",
    severity: "error",
    pattern: /\blorem ipsum\b/giu,
    message: "Lorem ipsum filler text is still present.",
  },
  {
    ruleId: "your-company",
    severity: "warning",
    pattern: /\byour company\b/giu,
    message:
      "Generic company placeholder text is still present. Replace it before launch.",
  },
  {
    ruleId: "your-email",
    severity: "warning",
    pattern: /\byour@email\b/giu,
    message:
      "Generic email placeholder text is still present. Replace it before launch.",
  },
  {
    ruleId: "placeholder",
    severity: "warning",
    pattern: /\bplaceholder\b/giu,
    message:
      "Placeholder marker is present. Confirm it is intentional before launch.",
  },
  {
    ruleId: "example-domain",
    severity: "warning",
    pattern:
      /\b(?:example\.com|example\.org|example\.net|[\w.-]+\.example|example[-_]domain)\b/giu,
    message:
      "Example domain appears in buyer-visible input. Confirm it is intentional before launch.",
  },
];
const STRICT_CLIENT_LAUNCH_BLOCKER_RULE_IDS = new Set([
  "example-domain",
  "example-offer",
  "example-standard",
  "fake-phone",
  "placeholder",
  "replace-this-image",
  "replaceable-content",
  "sample-product",
  "starter-identity",
  "your-company",
  "your-email",
]);
// 表单输入框 placeholder 字段（JSON key 以 Placeholder 结尾）里出现 your@email /
// Your company 是有意的 UX 占位文案——占位符字段的职责本就是展示示例文本，
// "Generic placeholder text ... replace before launch" 规则在这里是自我拆台。
// 具名放行这两条规则，避免永久的 3 条噪音 warning。零基线才有告警价值。
const FORM_PLACEHOLDER_FIELD_KEY_PATTERN = /placeholder$/iu;
const FORM_PLACEHOLDER_ALLOWED_RULE_IDS = new Set([
  "your-email",
  "your-company",
]);

function isFormPlaceholderField(scanUnit) {
  const lastSegment = (scanUnit.context ?? "").split(".").pop() ?? "";
  return FORM_PLACEHOLDER_FIELD_KEY_PATTERN.test(lastSegment);
}

const CONFIG_SOURCE_EXTENSIONS = new Set([".js", ".mjs", ".ts", ".tsx"]);
const TS_TYPE_ONLY_NODE_TYPES = new Set([
  "TSArrayType",
  "TSConditionalType",
  "TSConstructorType",
  "TSDeclareFunction",
  "TSExportAssignment",
  "TSExpressionWithTypeArguments",
  "TSFunctionType",
  "TSImportEqualsDeclaration",
  "TSIndexSignature",
  "TSIndexedAccessType",
  "TSInferType",
  "TSInstantiationExpression",
  "TSInterfaceBody",
  "TSInterfaceDeclaration",
  "TSIntersectionType",
  "TSLiteralType",
  "TSMappedType",
  "TSMethodSignature",
  "TSModuleBlock",
  "TSModuleDeclaration",
  "TSNamedTupleMember",
  "TSOptionalType",
  "TSParameterProperty",
  "TSParenthesizedType",
  "TSPropertySignature",
  "TSQualifiedName",
  "TSRestType",
  "TSThisType",
  "TSTupleType",
  "TSTypeAliasDeclaration",
  "TSTypeAnnotation",
  "TSTypeAssertion",
  "TSTypeLiteral",
  "TSTypeOperator",
  "TSTypeParameter",
  "TSTypeParameterDeclaration",
  "TSTypeParameterInstantiation",
  "TSTypePredicate",
  "TSTypeQuery",
  "TSTypeReference",
  "TSUnionType",
]);

function isReadinessExcludedPath(repoPath) {
  return (
    repoPath.startsWith("docs/") ||
    repoPath.startsWith("reports/") ||
    repoPath.startsWith("generated/") ||
    EXCLUDED_FILE_PATTERN.test(repoPath)
  );
}

function isReadinessSourceFile(repoPath, filePath, target) {
  if (!target.extensions.has(path.extname(filePath))) return false;
  if (target.allowedPath) return target.allowedPath(repoPath);
  return target.allowedPathPattern
    ? target.allowedPathPattern.test(repoPath)
    : true;
}

function collectReadinessFiles(rootDir, target) {
  const results = [];
  const startPath = path.join(rootDir, target.root);
  if (!fs.existsSync(startPath)) return results;

  function walk(currentPath) {
    const repoPath = toRepoPath(rootDir, currentPath);
    if (isReadinessExcludedPath(repoPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      if (GENERATED_DIR_NAMES.has(path.basename(currentPath))) return;

      const entries = fs
        .readdirSync(currentPath, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name));
      for (const entry of entries) walk(path.join(currentPath, entry.name));
      return;
    }

    if (
      stats.isFile() &&
      isReadinessSourceFile(repoPath, currentPath, target)
    ) {
      results.push({
        absolutePath: currentPath,
        repoPath,
        scanTextRules: target.scanTextRules,
        scanPathRules: target.scanPathRules ?? false,
      });
    }
  }

  walk(startPath);
  return results;
}

function getLineText(content, index) {
  const lineStart = content.lastIndexOf("\n", index - 1) + 1;
  const lineEnd = content.indexOf("\n", index);
  return content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
}

function getEffectiveSeverity(rule, scanUnit, index, options = {}) {
  const strictClientLaunch = options.strictClientLaunch === true;
  if (
    strictClientLaunch &&
    STRICT_CLIENT_LAUNCH_BLOCKER_RULE_IDS.has(rule.ruleId)
  ) {
    return "error";
  }

  if (rule.ruleId !== "fake-phone") return rule.severity;
  if (/placeholder/iu.test(scanUnit.context ?? "")) return "warning";
  if (/placeholder/iu.test(getLineText(scanUnit.value, index))) {
    return "warning";
  }
  return rule.severity;
}

function toJsonStringLiteral(value) {
  return JSON.stringify(value);
}

function getNextNonWhitespaceCharacter(content, index) {
  for (
    let currentIndex = index;
    currentIndex < content.length;
    currentIndex += 1
  ) {
    const character = content[currentIndex];
    if (!/\s/u.test(character)) return character;
  }
  return "";
}

function findJsonValueLiteralIndex(content, literal, startIndex) {
  let searchIndex = startIndex;

  while (searchIndex < content.length) {
    const literalIndex = content.indexOf(literal, searchIndex);
    if (literalIndex === -1) return -1;

    const nextCharacter = getNextNonWhitespaceCharacter(
      content,
      literalIndex + literal.length,
    );
    if (nextCharacter !== ":") return literalIndex;

    searchIndex = literalIndex + literal.length;
  }

  return -1;
}

function collectJsonStringValues(value, content, state, pointer = "") {
  if (typeof value === "string") {
    const literal = toJsonStringLiteral(value);
    const literalIndex = findJsonValueLiteralIndex(
      content,
      literal,
      state.searchIndex,
    );
    if (literalIndex !== -1) state.searchIndex = literalIndex + literal.length;

    return [
      {
        value,
        line:
          literalIndex === -1 ? 1 : getLineNumber(content, literalIndex + 1),
        context: pointer,
      },
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      collectJsonStringValues(item, content, state, `${pointer}.${index}`),
    );
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectJsonStringValues(item, content, state, `${pointer}.${key}`),
    );
  }

  return [];
}

function collectJsonScanUnits(content) {
  try {
    return collectJsonStringValues(JSON.parse(content), content, {
      searchIndex: 0,
    });
  } catch {
    return [{ value: content, line: 1 }];
  }
}

function isSkippableConfigString(value) {
  return (
    value.startsWith("/") ||
    value.startsWith("./") ||
    value.startsWith("../") ||
    /^https?:\/\/\S+\.(?:avif|gif|jpe?g|png|svg|webp)(?:[?#].*)?$/iu.test(value)
  );
}

function pushConfigStringUnit(units, value, content, node) {
  if (!value) return;

  units.push({
    value,
    line: node.loc?.start.line ?? getLineNumber(content, node.start ?? 0),
    skipTextRules: isSkippableConfigString(value),
  });
}

function collectStringLiteralsFromNode(node, units, content) {
  if (!node || typeof node !== "object") return;
  if (TS_TYPE_ONLY_NODE_TYPES.has(node.type)) return;
  if (node.type === "ImportDeclaration") return;
  if (node.type === "ExportAllDeclaration") return;

  if (
    node.type === "ExportNamedDeclaration" ||
    node.type === "ExportDefaultDeclaration"
  ) {
    collectStringLiteralsFromNode(node.declaration, units, content);
    return;
  }

  if (
    (node.type === "StringLiteral" || node.type === "DirectiveLiteral") &&
    typeof node.value === "string"
  ) {
    pushConfigStringUnit(units, node.value, content, node);
    return;
  }

  if (node.type === "TemplateElement") {
    const value = node.value?.cooked ?? node.value?.raw;
    pushConfigStringUnit(units, value, content, node);
    return;
  }

  if (node.type === "ObjectProperty" || node.type === "ObjectMethod") {
    if (node.computed) collectStringLiteralsFromNode(node.key, units, content);
    collectStringLiteralsFromNode(node.value ?? node.body, units, content);
    return;
  }

  for (const [key, value] of Object.entries(node)) {
    if (
      key === "comments" ||
      key === "leadingComments" ||
      key === "innerComments" ||
      key === "trailingComments" ||
      key === "loc" ||
      key === "start" ||
      key === "end"
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value)
        collectStringLiteralsFromNode(item, units, content);
      continue;
    }

    collectStringLiteralsFromNode(value, units, content);
  }
}

function collectConfigStringScanUnits(content) {
  const units = [];

  try {
    const ast = parse(content, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });
    collectStringLiteralsFromNode(ast.program, units, content);
  } catch {
    // Returning [] here would skip the whole file: syntax this parser version
    // does not know yet would silently exempt a config from the residue scan.
    // Fall back to the raw content, the same way JSON parse failures do.
    return [{ value: content, line: 1 }];
  }

  return units;
}

function collectPathScanUnits(repoPath) {
  return [{ value: repoPath, line: 1 }];
}

function stripMdxComments(content) {
  return content.replaceAll(/\{\/\*[\s\S]*?\*\/\}|<!--[\s\S]*?-->/gu, (match) =>
    "\n".repeat(match.split("\n").length - 1),
  );
}

function collectScanUnits(content, filePath) {
  const extension = path.extname(filePath);
  if (extension === ".json") return collectJsonScanUnits(content);
  if (CONFIG_SOURCE_EXTENSIONS.has(extension)) {
    return collectConfigStringScanUnits(content);
  }

  const scanContent =
    extension === ".mdx" ? stripMdxComments(content) : content;

  return scanContent.split("\n").map((line, index) => ({
    value: line,
    line: index + 1,
  }));
}

function isContentRuntimeLogoReference(file, unit) {
  return (
    file.repoPath.startsWith("content/pages/") &&
    (MARKDOWN_LOGO_REFERENCE_PATTERN.test(unit.value) ||
      ATTRIBUTE_LOGO_REFERENCE_PATTERN.test(unit.value))
  );
}

function findRuntimeLogoReferenceUnit(file, scanUnits) {
  if (file.scanPathRules) return undefined;

  return scanUnits.find((unit) => isContentRuntimeLogoReference(file, unit));
}

function scanReadinessFile(rootDir, file, options = {}) {
  const content = fs.readFileSync(file.absolutePath, "utf8");
  const scanUnits = file.scanPathRules
    ? collectPathScanUnits(file.repoPath)
    : collectScanUnits(content, file.absolutePath);
  const findings = [];

  for (const unit of scanUnits) {
    if (unit.skipTextRules) continue;

    for (const rule of TEXT_RULES) {
      rule.pattern.lastIndex = 0;

      if (
        FORM_PLACEHOLDER_ALLOWED_RULE_IDS.has(rule.ruleId) &&
        isFormPlaceholderField(unit)
      ) {
        continue;
      }

      for (const match of unit.value.matchAll(rule.pattern)) {
        const index = match.index ?? 0;
        findings.push({
          file: file.repoPath,
          line: unit.line,
          ruleId: rule.ruleId,
          severity: getEffectiveSeverity(rule, unit, index, options),
          message: rule.message,
          match: match[0],
        });
      }
    }
  }

  const logoReferenceUnit = findRuntimeLogoReferenceUnit(file, scanUnits);
  const hasLogoReference = Boolean(logoReferenceUnit);
  const hasLogoAsset = fs.existsSync(path.join(rootDir, LOGO_ASSET_PATH));
  if (hasLogoReference && !hasLogoAsset) {
    findings.push({
      file: file.repoPath,
      line: logoReferenceUnit.line,
      ruleId: "missing-logo-asset",
      severity: "error",
      message:
        "Runtime reference to /images/logo.svg exists, but public/images/logo.svg is missing.",
      match: LOGO_REFERENCE,
    });
  }

  return findings;
}

function collectReadinessScanFiles(rootDir = ROOT) {
  return READINESS_SCAN_TARGETS.flatMap((target) =>
    collectReadinessFiles(rootDir, target),
  );
}

function collectContentReadinessFindings(rootDir = ROOT, options = {}) {
  const files = collectReadinessScanFiles(rootDir);
  return files.flatMap((file) =>
    file.scanTextRules || file.scanPathRules
      ? scanReadinessFile(rootDir, file, options)
      : [],
  );
}

function runContentReadinessCheck(rootDir = ROOT, options = {}) {
  const findings = collectContentReadinessFindings(rootDir, options);
  const errors = findings.filter((finding) => finding.severity === "error");
  const warnings = findings.filter((finding) => finding.severity === "warning");

  // "No residue found" has to mean something was inspected. An empty scan set
  // means the targets moved, not that the content is clean.
  const scannedFileCount = collectReadinessScanFiles(rootDir).length;
  if (scannedFileCount === 0) {
    errors.push({
      severity: "error",
      file: "scripts/quality/checks/content-readiness.js",
      line: 1,
      ruleId: "empty-scan-set",
      message: "content readiness scanned no files; scan targets are missing",
    });
    findings.push(errors[errors.length - 1]);
  }

  return {
    scannedFileCount,
    status: errors.length > 0 ? "failed" : "passed",
    findings,
    errors,
    warnings,
  };
}

function printReadinessFinding(finding) {
  const suffix = finding.match ? ` (${finding.match})` : "";
  console.error(
    `- [${finding.severity}] ${finding.file}:${finding.line} ${finding.ruleId}: ${finding.message}${suffix}`,
  );
}

function runContentReadinessCli(args = []) {
  const result = runContentReadinessCheck(ROOT, {
    strictClientLaunch: args.includes("--strict-client-launch"),
  });

  if (result.findings.length === 0) {
    console.log("content readiness passed: no buyer-visible residue found");
    return true;
  }

  const summary = `content readiness ${result.status}: ${result.errors.length} error(s), ${result.warnings.length} warning(s)`;
  const log = result.status === "failed" ? console.error : console.log;
  log(summary);
  for (const finding of result.findings) printReadinessFinding(finding);

  return result.status !== "failed";
}

module.exports = {
  collectContentReadinessFindings,
  collectReadinessScanFiles,
  runContentReadinessCheck,
  runContentReadinessCli,
};
