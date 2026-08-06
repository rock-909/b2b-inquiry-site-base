const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const ts = require("typescript");
const { composeCatalogMessages, collectLeafPaths } = require("./translations");
const {
  collectDerivedKeyConsumerUsage,
  collectObjectKeyConsumerUsage,
  getBindingIdentifier,
  isConstVariableDeclaration,
} = require("./message-key-consumers");
const {
  DYNAMIC_MESSAGE_KEY_PREFIXES,
  MESSAGE_DERIVED_KEY_CONSUMERS,
  MESSAGE_OBJECT_KEY_CONSUMERS,
  TRANSLATOR_PARAMETER_OVERRIDES,
  UNUSED_MESSAGE_KEYS,
} = require("../message-key-usage-baseline");

/**
 * @typedef {Object} DerivedKeyConsumer
 * @property {string} kind
 * @property {string} file
 * @property {string} reason
 * @property {string=} sourceName
 * @property {string=} valueProperty
 * @property {string=} rootName
 * @property {string=} ownerFunction
 * @property {string=} callee
 * @property {{
 *   sourceName: string,
 *   filters: {property: string, equals: string | number | boolean}[],
 * }=} entryKeySource
 * @property {string=} prefix
 * @property {string[]=} prefixes
 * @property {string[]=} suffixes
 * @property {{property: string, equals: string | number | boolean}[]=} entryFilters
 */

const ROOT = process.cwd();
const DEFAULT_LOCALE = require("../../../i18n-locales.config").defaultLocale;
const SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mdx",
  ".mjs",
  ".ts",
  ".tsx",
]);
const SOURCE_ROOTS = [".storybook", "content", "scripts", "src", "tests"];
const SELF_FILES = new Set([
  "scripts/quality/checks/message-key-usage.js",
  "scripts/quality/checks/message-key-consumers.js",
  "scripts/quality/message-key-usage-baseline.js",
]);
const UNKNOWN_TRANSLATION_NAMESPACE = Symbol("unknown-translation-namespace");

function getCatalogKeys(locale = DEFAULT_LOCALE) {
  const composed = composeCatalogMessages(locale);
  return new Set(collectLeafPaths(composed));
}

function collectUsageSourceFiles(rootDir = ROOT) {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--", ...SOURCE_ROOTS],
    {
      cwd: rootDir,
      encoding: "utf8",
    },
  );
  return output
    .split("\0")
    .filter(Boolean)
    .filter((file) => SOURCE_EXTENSIONS.has(path.extname(file)))
    .filter((file) => !SELF_FILES.has(file));
}

function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isAsExpression(current) ||
      ts.isAwaitExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isParenthesizedExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }
  return current;
}

function getStaticString(node, constants) {
  const current = unwrapExpression(node);
  if (
    current &&
    (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current))
  ) {
    return current.text;
  }
  if (current && ts.isIdentifier(current)) return constants.get(current.text);
  return undefined;
}

function getTranslationNamespace(callExpression, constants) {
  const firstArgument = callExpression.arguments[0];
  const direct = getStaticString(firstArgument, constants);
  if (direct !== undefined) return direct;
  if (firstArgument && ts.isObjectLiteralExpression(firstArgument)) {
    const namespaceProperty = firstArgument.properties.find(
      (property) =>
        ts.isPropertyAssignment(property) &&
        property.name.getText() === "namespace",
    );
    if (namespaceProperty && ts.isPropertyAssignment(namespaceProperty)) {
      return getStaticString(namespaceProperty.initializer, constants);
    }
  }
  return firstArgument === undefined ? "" : undefined;
}

function getImportDeclaration(node) {
  let current = node;
  while (current && !ts.isImportDeclaration(current)) {
    current = current.parent;
  }
  return current;
}

function getImportedBinding(expression, checker) {
  if (ts.isIdentifier(expression)) {
    const symbol = checker.getSymbolAtLocation(expression);
    const declaration = symbol?.declarations?.find(ts.isImportSpecifier);
    if (!declaration) return undefined;
    const importDeclaration = getImportDeclaration(declaration);
    if (
      !importDeclaration ||
      !ts.isStringLiteral(importDeclaration.moduleSpecifier)
    ) {
      return undefined;
    }
    return {
      importedName: declaration.propertyName?.text ?? declaration.name.text,
      moduleName: importDeclaration.moduleSpecifier.text,
    };
  }
  if (!ts.isPropertyAccessExpression(expression)) return undefined;
  const namespace = unwrapExpression(expression.expression);
  if (!namespace || !ts.isIdentifier(namespace)) return undefined;
  const symbol = checker.getSymbolAtLocation(namespace);
  const declaration = symbol?.declarations?.find(ts.isNamespaceImport);
  if (!declaration) return undefined;
  const importDeclaration = getImportDeclaration(declaration);
  if (
    !importDeclaration ||
    !ts.isStringLiteral(importDeclaration.moduleSpecifier)
  ) {
    return undefined;
  }
  return {
    importedName: expression.name.text,
    moduleName: importDeclaration.moduleSpecifier.text,
  };
}

function isSupportedTranslationFactory(expression, checker) {
  const imported = getImportedBinding(expression, checker);
  return (
    (imported?.importedName === "useTranslations" &&
      imported.moduleName === "next-intl") ||
    (imported?.importedName === "getTranslations" &&
      imported.moduleName === "next-intl/server")
  );
}

function getTranslatorNamespaceFromExpression(node, constants, checker) {
  const expression = unwrapExpression(node);
  if (!expression || !ts.isCallExpression(expression)) return undefined;
  if (!isSupportedTranslationFactory(expression.expression, checker)) {
    return undefined;
  }
  return (
    getTranslationNamespace(expression, constants) ??
    UNKNOWN_TRANSLATION_NAMESPACE
  );
}

function joinMessageKey(namespace, key) {
  return namespace ? `${namespace}.${key}` : key;
}

function getPromiseAllInputs(node, checker) {
  const initializer = unwrapExpression(node);
  if (
    !initializer ||
    !ts.isCallExpression(initializer) ||
    !ts.isPropertyAccessExpression(initializer.expression) ||
    !ts.isIdentifier(initializer.expression.expression) ||
    initializer.expression.expression.text !== "Promise" ||
    checker.getSymbolAtLocation(initializer.expression.expression) !==
      undefined ||
    initializer.expression.name.text !== "all"
  ) {
    return null;
  }
  const inputs = unwrapExpression(initializer.arguments[0]);
  return inputs && ts.isArrayLiteralExpression(inputs) ? inputs.elements : null;
}

function isConstInitializedVariableDeclaration(node) {
  return (
    ts.isVariableDeclaration(node) &&
    isConstVariableDeclaration(node) &&
    node.initializer !== undefined
  );
}

function getTopLevelFunctionName(node) {
  if (
    ts.isFunctionDeclaration(node) &&
    ts.isSourceFile(node.parent) &&
    node.name
  ) {
    return node.name.text;
  }
  let current = node.parent;
  while (current) {
    if (ts.isVariableDeclaration(current) && ts.isIdentifier(current.name)) {
      const statement = current.parent?.parent;
      return statement &&
        isConstVariableDeclaration(current) &&
        ts.isVariableStatement(statement) &&
        ts.isSourceFile(statement.parent)
        ? current.name.text
        : null;
    }
    if (ts.isFunctionLike(current)) return null;
    current = current.parent;
  }
  return null;
}

function collectTranslatorBindings({
  sourceFile,
  checker,
  constants,
  parameterOverrides,
}) {
  const translatorBindings = new Map();
  const parameterOverrideCandidates = new Map(
    parameterOverrides.map((override) => [override, []]),
  );

  function collectBindings(node) {
    if (isConstInitializedVariableDeclaration(node)) {
      if (ts.isIdentifier(node.name)) {
        const namespace = getTranslatorNamespaceFromExpression(
          node.initializer,
          constants,
          checker,
        );
        const symbol = checker.getSymbolAtLocation(node.name);
        if (namespace !== undefined && symbol) {
          translatorBindings.set(symbol, namespace);
        }
      } else if (ts.isArrayBindingPattern(node.name)) {
        const inputs = getPromiseAllInputs(node.initializer, checker);
        for (const [index, binding] of node.name.elements.entries()) {
          if (!inputs || !ts.isBindingElement(binding)) continue;
          if (!ts.isIdentifier(binding.name)) continue;
          const namespace = getTranslatorNamespaceFromExpression(
            inputs[index],
            constants,
            checker,
          );
          const symbol = checker.getSymbolAtLocation(binding.name);
          if (namespace !== undefined && symbol) {
            translatorBindings.set(symbol, namespace);
          }
        }
      }
    } else if (ts.isParameter(node)) {
      const functionName = getTopLevelFunctionName(node.parent);
      for (const override of parameterOverrides) {
        if (override.functionName !== functionName) continue;
        const identifier = getBindingIdentifier(node.name, override.identifier);
        if (identifier) {
          const symbol = checker.getSymbolAtLocation(identifier);
          if (symbol) {
            parameterOverrideCandidates.get(override).push(symbol);
          }
        }
      }
    }
    ts.forEachChild(node, collectBindings);
  }
  collectBindings(sourceFile);
  const parameterOverrideMatchCounts = new Map();
  for (const override of parameterOverrides) {
    const candidates = parameterOverrideCandidates.get(override);
    parameterOverrideMatchCounts.set(override, candidates.length);
    if (candidates.length === 1) {
      translatorBindings.set(candidates[0], override.namespace);
    }
  }
  return { parameterOverrideMatchCounts, translatorBindings };
}

function collectForwardedTranslatorCalls(
  sourceFile,
  checker,
  translatorBindings,
) {
  const forwardedTranslatorCalls = new Set();

  function registerForwardedTranslator(node, translator, body) {
    const translatorSymbol = checker.getSymbolAtLocation(translator);
    const forwardedSymbol = checker.getSymbolAtLocation(node.name);
    const namespace = translatorSymbol
      ? translatorBindings.get(translatorSymbol)
      : undefined;
    if (namespace === undefined || !forwardedSymbol) return;
    translatorBindings.set(forwardedSymbol, namespace);
    forwardedTranslatorCalls.add(body);
  }

  function collectForwardedBindings(node) {
    if (
      ts.isVariableDeclaration(node) &&
      isConstVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const initializer = unwrapExpression(node.initializer);
      if (
        initializer &&
        ts.isArrowFunction(initializer) &&
        initializer.parameters.length === 1 &&
        ts.isIdentifier(initializer.parameters[0].name)
      ) {
        const body = unwrapExpression(initializer.body);
        if (body && ts.isCallExpression(body)) {
          let translator = body.expression;
          if (ts.isPropertyAccessExpression(translator)) {
            translator = translator.expression;
          }
          const argument = unwrapExpression(body.arguments[0]);
          if (
            ts.isIdentifier(translator) &&
            argument &&
            ts.isIdentifier(argument) &&
            argument.text === initializer.parameters[0].name.text
          ) {
            registerForwardedTranslator(node, translator, body);
          }
        }
      }
    }
    ts.forEachChild(node, collectForwardedBindings);
  }
  collectForwardedBindings(sourceFile);
  return forwardedTranslatorCalls;
}

function collectTranslatorCallUsage({
  node,
  checker,
  translatorBindings,
  constants,
  staticKeys,
  dynamicPrefixes,
}) {
  let translator = node.expression;
  if (ts.isPropertyAccessExpression(translator)) {
    translator = translator.expression;
  }
  if (!ts.isIdentifier(translator)) return;
  const symbol = checker.getSymbolAtLocation(translator);
  if (!symbol) return;
  const namespace = translatorBindings.get(symbol);
  if (namespace === undefined) return;
  if (namespace === UNKNOWN_TRANSLATION_NAMESPACE) {
    dynamicPrefixes.add("");
    return;
  }
  const keyArgument = unwrapExpression(node.arguments[0]);
  const key = getStaticString(keyArgument, constants);
  if (key !== undefined) {
    staticKeys.add(joinMessageKey(namespace, key));
  } else if (keyArgument && ts.isTemplateExpression(keyArgument)) {
    dynamicPrefixes.add(joinMessageKey(namespace, keyArgument.head.text));
  } else {
    dynamicPrefixes.add(namespace ? `${namespace}.` : "");
  }
}

function collectRequiredMessagePathUsage({
  node,
  checker,
  constants,
  staticKeys,
  dynamicPrefixes,
}) {
  const imported = getImportedBinding(node.expression, checker);
  if (
    imported?.importedName !== "readRequiredMessagePath" ||
    imported.moduleName !== "@/lib/i18n/read-message-path"
  ) {
    return;
  }
  const pathArgument = unwrapExpression(node.arguments[1]);
  if (!pathArgument || !ts.isArrayLiteralExpression(pathArgument)) {
    dynamicPrefixes.add("");
    return;
  }

  const segments = [];
  let dynamic = false;
  for (const element of pathArgument.elements) {
    const segment = getStaticString(element, constants);
    if (segment === undefined) {
      dynamic = true;
      break;
    }
    segments.push(segment);
  }
  if (segments.length === 0) {
    if (dynamic || pathArgument.elements.length === 0) dynamicPrefixes.add("");
    return;
  }
  const key = segments.join(".");
  if (dynamic) dynamicPrefixes.add(`${key}.`);
  else staticKeys.add(key);
}

function collectSourceUsage({
  sourceFile,
  checker,
  constants,
  translatorParameterOverrides,
}) {
  const { parameterOverrideMatchCounts, translatorBindings } =
    collectTranslatorBindings({
      sourceFile,
      checker,
      constants,
      parameterOverrides: translatorParameterOverrides,
    });
  const forwardedTranslatorCalls = collectForwardedTranslatorCalls(
    sourceFile,
    checker,
    translatorBindings,
  );
  const staticKeys = new Set();
  const dynamicPrefixes = new Set();

  function collectNode(node) {
    if (ts.isCallExpression(node) && !forwardedTranslatorCalls.has(node)) {
      collectTranslatorCallUsage({
        node,
        checker,
        translatorBindings,
        constants,
        staticKeys,
        dynamicPrefixes,
      });
      collectRequiredMessagePathUsage({
        node,
        checker,
        constants,
        staticKeys,
        dynamicPrefixes,
      });
    }
    ts.forEachChild(node, collectNode);
  }
  collectNode(sourceFile);

  return { dynamicPrefixes, parameterOverrideMatchCounts, staticKeys };
}

function createSourceProgram({ rootDir, sourceEntries }) {
  const options = {
    allowJs: true,
    checkJs: false,
    jsx: ts.JsxEmit.Preserve,
    module: ts.ModuleKind.ESNext,
    noLib: true,
    noResolve: true,
    target: ts.ScriptTarget.Latest,
  };
  const entriesByPath = new Map(
    sourceEntries.map((entry) => [path.resolve(rootDir, entry.file), entry]),
  );
  const host = {
    fileExists: (fileName) => entriesByPath.has(path.resolve(fileName)),
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => rootDir,
    getDefaultLibFileName: () => "lib.d.ts",
    getDirectories: () => [],
    getNewLine: () => "\n",
    getSourceFile(fileName, languageVersion) {
      const absolutePath = path.resolve(fileName);
      const entry = entriesByPath.get(absolutePath);
      if (!entry) return undefined;
      const scriptKind = entry.file.endsWith("x")
        ? ts.ScriptKind.TSX
        : ts.ScriptKind.TS;
      return ts.createSourceFile(
        absolutePath,
        entry.content,
        languageVersion,
        true,
        scriptKind,
      );
    },
    readFile(fileName) {
      return entriesByPath.get(path.resolve(fileName))?.content;
    },
    useCaseSensitiveFileNames: () => true,
    writeFile: () => undefined,
  };
  const program = ts.createProgram({
    rootNames: [...entriesByPath.keys()],
    options,
    host,
  });
  return {
    checker: program.getTypeChecker(),
    sourceFiles: new Map(
      sourceEntries.map((entry) => [
        entry.file,
        program.getSourceFile(path.resolve(rootDir, entry.file)),
      ]),
    ),
  };
}

function collectBindingIdentifiers(bindingName, identifiers) {
  if (ts.isIdentifier(bindingName)) {
    identifiers.push(bindingName.text);
    return;
  }
  for (const element of bindingName.elements) {
    if (ts.isBindingElement(element)) {
      collectBindingIdentifiers(element.name, identifiers);
    }
  }
}

function collectFileStringConstants({ file, content }) {
  const sourceFile = ts.createSourceFile(
    file,
    content,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declarations = new Map();

  function recordDeclaration(name, value) {
    const values = declarations.get(name) ?? [];
    values.push(value);
    declarations.set(name, values);
  }

  function recordBinding(bindingName, value) {
    const identifiers = [];
    collectBindingIdentifiers(bindingName, identifiers);
    for (const identifier of identifiers) recordDeclaration(identifier, value);
  }

  function visit(node) {
    if (ts.isVariableDeclaration(node)) {
      recordBinding(
        node.name,
        isConstVariableDeclaration(node) && node.initializer
          ? getStaticString(node.initializer, new Map())
          : undefined,
      );
    } else if (ts.isParameter(node)) {
      recordBinding(node.name, undefined);
    } else if (ts.isImportClause(node) && node.name) {
      recordDeclaration(node.name.text, undefined);
    } else if (ts.isImportSpecifier(node)) {
      recordDeclaration(node.name.text, undefined);
    } else if (ts.isNamespaceImport(node)) {
      recordDeclaration(node.name.text, undefined);
    } else if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    ) {
      recordDeclaration(node.name.text, undefined);
    } else if (ts.isCatchClause(node) && node.variableDeclaration) {
      recordBinding(node.variableDeclaration.name, undefined);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);

  const constants = new Map();
  for (const [name, values] of declarations) {
    if (values.length === 1 && values[0] !== undefined) {
      constants.set(name, values[0]);
    }
  }
  return constants;
}

function collectSourceUsageSummary({
  rootDir,
  sourceEntries,
  translatorParameterOverrides,
}) {
  const staticKeys = new Set();
  const dynamicPrefixes = new Set();
  const parameterOverrideMatchCounts = new Map();
  const program = createSourceProgram({ rootDir, sourceEntries });
  for (const entry of sourceEntries) {
    const sourceFile = program.sourceFiles.get(entry.file);
    if (!sourceFile) continue;
    const constants = collectFileStringConstants(entry);
    const usage = collectSourceUsage({
      sourceFile,
      checker: program.checker,
      constants,
      translatorParameterOverrides: translatorParameterOverrides.filter(
        (override) => override.file === entry.file,
      ),
    });
    for (const key of usage.staticKeys) staticKeys.add(key);
    for (const prefix of usage.dynamicPrefixes) dynamicPrefixes.add(prefix);
    for (const [override, count] of usage.parameterOverrideMatchCounts) {
      parameterOverrideMatchCounts.set(override, count);
    }
  }
  return {
    checker: program.checker,
    dynamicPrefixes,
    parameterOverrideMatchCounts,
    sourceFiles: program.sourceFiles,
    staticKeys,
  };
}

function collectTranslatorParameterOverrideFindings(
  translatorParameterOverrides,
  parameterOverrideMatchCounts,
) {
  return translatorParameterOverrides.flatMap((override) => {
    const matchCount = parameterOverrideMatchCounts.get(override) ?? 0;
    if (matchCount === 1) return [];
    const status = matchCount === 0 ? "stale" : "ambiguous";
    return [
      {
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `translator parameter override is ${status} "${override.file}#${override.functionName}:${override.identifier}"`,
      },
    ];
  });
}

function collectDynamicPrefixFindings({
  catalogKeys,
  observedDynamicPrefixes,
  dynamicPrefixAllowlist,
}) {
  const findings = [];
  const allowedPrefixes = new Set(
    dynamicPrefixAllowlist.map(({ prefix }) => prefix),
  );
  for (const prefix of observedDynamicPrefixes) {
    if (prefix && allowedPrefixes.has(prefix)) continue;
    findings.push({
      file: "scripts/quality/message-key-usage-baseline.js",
      error: `dynamic message key prefix is not allowlisted "${prefix || "<unknown>"}"`,
    });
  }
  for (const { prefix } of dynamicPrefixAllowlist) {
    if (![...catalogKeys].some((key) => key.startsWith(prefix))) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `dynamic message key prefix matches no catalog key "${prefix}"`,
      });
    } else if (!observedDynamicPrefixes.has(prefix)) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `dynamic message key prefix is stale because no consumer emits it "${prefix}"`,
      });
    }
  }
  return findings;
}

function collectMissingUsedKeyFindings(catalogKeys, staticKeys) {
  return [...staticKeys]
    .filter((key) => !catalogKeys.has(key))
    .map((key) => ({
      file: "message usage",
      error: `used message key is missing from the catalog "${key}"`,
    }));
}

function collectUnusedKeyFindings({
  catalogKeys,
  usedKeys,
  unusedKeyAllowlist,
}) {
  const findings = [];
  const unusedAllowlist = new Set(unusedKeyAllowlist);
  for (const key of catalogKeys) {
    if (usedKeys.has(key) || unusedAllowlist.has(key)) continue;
    findings.push({
      file: "messages",
      error: `message key has no detected consumer and is not baselined "${key}"`,
    });
  }
  for (const key of unusedAllowlist) {
    if (!catalogKeys.has(key)) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `unused message key baseline is stale because the key is absent "${key}"`,
      });
    } else if (usedKeys.has(key)) {
      findings.push({
        file: "scripts/quality/message-key-usage-baseline.js",
        error: `unused message key baseline is stale because the key is now consumed "${key}"`,
      });
    }
  }
  return findings;
}

function collectMessageKeyUsageFindings({
  rootDir = ROOT,
  catalogKeys = getCatalogKeys(),
  sourceFiles = collectUsageSourceFiles(rootDir),
  dynamicPrefixAllowlist = DYNAMIC_MESSAGE_KEY_PREFIXES,
  derivedKeyConsumers = /** @type {DerivedKeyConsumer[]} */ (
    MESSAGE_DERIVED_KEY_CONSUMERS
  ),
  objectKeyConsumers = MESSAGE_OBJECT_KEY_CONSUMERS,
  translatorParameterOverrides = TRANSLATOR_PARAMETER_OVERRIDES,
  unusedKeyAllowlist = UNUSED_MESSAGE_KEYS,
} = {}) {
  const sourceEntries = sourceFiles
    .filter((file) => fs.existsSync(path.join(rootDir, file)))
    .map((file) => ({
      file,
      content: fs.readFileSync(path.join(rootDir, file), "utf8"),
    }));
  const sourceUsage = collectSourceUsageSummary({
    rootDir,
    sourceEntries,
    translatorParameterOverrides,
  });

  const objectKeyUsage = collectObjectKeyConsumerUsage({
    sourceProgram: {
      checker: sourceUsage.checker,
      sourceFiles: sourceUsage.sourceFiles,
    },
    objectKeyConsumers,
    unwrapExpression,
    getStaticString,
  });
  const derivedKeyUsage = collectDerivedKeyConsumerUsage({
    sourceEntries,
    sourceProgram: {
      checker: sourceUsage.checker,
      sourceFiles: sourceUsage.sourceFiles,
    },
    catalogKeys,
    derivedKeyConsumers,
    unwrapExpression,
    getStaticString,
  });
  const staticKeys = new Set([
    ...sourceUsage.staticKeys,
    ...objectKeyUsage.staticKeys,
    ...derivedKeyUsage.staticKeys,
  ]);
  const usedKeys = new Set(staticKeys);

  return [
    ...collectTranslatorParameterOverrideFindings(
      translatorParameterOverrides,
      sourceUsage.parameterOverrideMatchCounts,
    ),
    ...objectKeyUsage.findings,
    ...derivedKeyUsage.findings,
    ...collectDynamicPrefixFindings({
      catalogKeys,
      observedDynamicPrefixes: sourceUsage.dynamicPrefixes,
      dynamicPrefixAllowlist,
    }),
    ...collectMissingUsedKeyFindings(catalogKeys, staticKeys),
    ...collectUnusedKeyFindings({
      catalogKeys,
      usedKeys,
      unusedKeyAllowlist,
    }),
  ];
}

function runMessageKeyUsageCheck() {
  const findings = collectMessageKeyUsageFindings();
  if (findings.length === 0) {
    console.log("message-key-usage: passed");
    return true;
  }
  console.error("message-key-usage: failed");
  for (const finding of findings)
    console.error(`- ${finding.file}: ${finding.error}`);
  return false;
}

module.exports = {
  collectDerivedKeyConsumerUsage,
  collectMessageKeyUsageFindings,
  collectUsageSourceFiles,
  getCatalogKeys,
  runMessageKeyUsageCheck,
};
