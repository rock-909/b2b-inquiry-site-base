const ts = require("typescript");
const postcss = require("postcss");

const RADIX_PACKAGE_PATTERN = /^@radix-ui\/[^/]+(?:\/.*)?$/;
const RADIX_THEMES_PATTERN = /^@radix-ui\/themes(?:\/.*)?$/;
const RADIX_PRIMITIVE_PATTERN = /^@radix-ui\/react-[^/]+(?:\/.*)?$/;
const RADIX_CSS_IMPORT_SPECIFIER_PATTERN =
  /^(?:url\s*\(\s*)?["']?(@radix-ui\/[^\s"');]+)["']?/i;

function unwrapTransparentExpression(node) {
  let current = node;

  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }

  return current;
}

function getStringLiteralValue(node) {
  const unwrapped = unwrapTransparentExpression(node);
  return ts.isStringLiteralLike(unwrapped) ? unwrapped.text : null;
}

function collectModuleReferences(source, filePath) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const references = [];

  function addReference(node) {
    const specifier = getStringLiteralValue(node);
    if (specifier === null) return;

    const { line } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    );
    references.push({ specifier, line: line + 1 });
  }

  function visit(node) {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier
    ) {
      addReference(node.moduleSpecifier);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      node.moduleReference.expression
    ) {
      addReference(node.moduleReference.expression);
    } else if (ts.isCallExpression(node)) {
      const callTarget = unwrapTransparentExpression(node.expression);
      // Keep dynamic import() even when the specifier is not Radix.
      if (callTarget.kind === ts.SyntaxKind.ImportKeyword) {
        addReference(node.arguments[0]);
      }

      // Hard package boundary: any call arg that is a static @radix-ui/*
      // string counts, regardless of require / createRequire / alias / .call.
      for (const argument of node.arguments) {
        const specifier = getStringLiteralValue(argument);
        if (specifier !== null && RADIX_PACKAGE_PATTERN.test(specifier)) {
          addReference(argument);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return references;
}

function findModuleReference(references, packagePattern) {
  return (
    references.find(({ specifier }) => packagePattern.test(specifier)) ?? null
  );
}

function getRadixModuleReferenceSummary(
  source,
  filePath = "component-governance-source.tsx",
) {
  const references = collectModuleReferences(source, filePath);

  return {
    packageReference: findModuleReference(references, RADIX_PACKAGE_PATTERN),
    primitiveReference: findModuleReference(
      references,
      RADIX_PRIMITIVE_PATTERN,
    ),
    themesReference: findModuleReference(references, RADIX_THEMES_PATTERN),
  };
}

// 只取第一个匹配会漏掉同一个 wrapper 里的第二个 Radix import，架构测试要的是全部。
function collectRadixPackageSpecifiers(
  source,
  filePath = "component-governance-source.tsx",
) {
  return [
    ...new Set(
      collectModuleReferences(source, filePath)
        .map(({ specifier }) => specifier)
        .filter((specifier) => RADIX_PACKAGE_PATTERN.test(specifier)),
    ),
  ];
}

function collectCssImportReferences(source) {
  const references = [];
  const root = postcss.parse(source, { from: undefined });

  root.walkAtRules((atRule) => {
    if (atRule.name.toLowerCase() !== "import") return;

    const normalizedParams = atRule.params
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .trim();
    const match = RADIX_CSS_IMPORT_SPECIFIER_PATTERN.exec(normalizedParams);
    if (!match || !RADIX_PACKAGE_PATTERN.test(match[1])) return;

    references.push({
      specifier: match[1],
      line: atRule.source?.start?.line ?? 1,
    });
  });

  return references;
}

function getCssRadixModuleReferenceSummary(source) {
  const references = collectCssImportReferences(source);

  return {
    packageReference: references[0] ?? null,
    themesReference: findModuleReference(references, RADIX_THEMES_PATTERN),
  };
}

function findRadixPackageReference(source, filePath) {
  return getRadixModuleReferenceSummary(source, filePath).packageReference;
}

function findRadixThemesReference(source, filePath) {
  return getRadixModuleReferenceSummary(source, filePath).themesReference;
}

function findRadixPrimitiveReference(source, filePath) {
  return getRadixModuleReferenceSummary(source, filePath).primitiveReference;
}

// Next.js只认文件顶部、任何 import 之前的指令。用 /m 正则扫全文会把模板字符串里
// 的示例、import 之后的无效语句都算成 client boundary——那会逼 registry 声明一个
// client-boundary 门禁并不认可的值，两个门禁互相打架。按 AST 的指令序言判定。
function hasUseClientDirective(
  source,
  filePath = "component-governance-source.tsx",
) {
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
  );

  for (const statement of sourceFile.statements) {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isStringLiteralLike(statement.expression)
    ) {
      return false;
    }
    if (statement.expression.text === "use client") return true;
  }

  return false;
}

function getExpectedClientBoundary(source) {
  return hasUseClientDirective(source) ? "client" : "server-safe";
}

function getExpectedRadixLayer(source) {
  const { primitiveReference } = getRadixModuleReferenceSummary(source);

  if (primitiveReference) return "primitive";
  return "local";
}

module.exports = {
  getExpectedClientBoundary,
  getExpectedRadixLayer,
  getCssRadixModuleReferenceSummary,
  getRadixModuleReferenceSummary,
  findRadixPackageReference,
  findRadixPrimitiveReference,
  findRadixThemesReference,
  collectRadixPackageSpecifiers,
};
