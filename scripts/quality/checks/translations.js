const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const ROOT = process.cwd();
const I18N_LOCALES = require("../../../i18n-locales.config").locales;

function getMessagePath(locale) {
  return path.posix.join("messages", "base", locale, "messages.json");
}

function getMessageAbsolutePath(locale) {
  return path.join(ROOT, getMessagePath(locale));
}

function readJsonSource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readJsonSource(filePath));
}

/** Detect duplicate object keys before JSON.parse silently drops one. */
function findDuplicateJsonObjectKeys(source) {
  const sourceFile = ts.parseJsonText("messages.json", source);
  const duplicates = [];

  function propertyName(property) {
    if (
      ts.isIdentifier(property.name) ||
      ts.isStringLiteral(property.name) ||
      ts.isNumericLiteral(property.name)
    ) {
      return property.name.text;
    }

    return property.name.getText(sourceFile).replace(/^"|"$/gu, "");
  }

  function walk(node, pathPrefix) {
    if (ts.isObjectLiteralExpression(node)) {
      const seenKeys = new Set();

      for (const property of node.properties) {
        if (!ts.isPropertyAssignment(property)) continue;

        const key = propertyName(property);
        const keyPath = pathPrefix === "" ? key : `${pathPrefix}.${key}`;

        if (seenKeys.has(key)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(
            property.getStart(sourceFile),
          );
          duplicates.push({ key, line: line + 1, path: keyPath });
        } else {
          seenKeys.add(key);
        }

        walk(property.initializer, keyPath);
      }
      return;
    }

    if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((element, index) => {
        walk(
          element,
          pathPrefix === "" ? `[${index}]` : `${pathPrefix}[${index}]`,
        );
      });
    }
  }

  const statement = sourceFile.statements[0];
  if (statement && ts.isExpressionStatement(statement)) {
    walk(statement.expression, "");
  }

  return duplicates;
}

function collectLeafPaths(value, prefix = "") {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    collectLeafPaths(nested, prefix ? `${prefix}.${key}` : key),
  );
}

function validateLocale(locale) {
  const relativePath = getMessagePath(locale);
  const absolutePath = getMessageAbsolutePath(locale);

  if (!fs.existsSync(absolutePath)) {
    console.error(`   Error: message file not found: ${relativePath}`);
    return null;
  }

  const source = readJsonSource(absolutePath);
  const duplicates = findDuplicateJsonObjectKeys(source);
  if (duplicates.length > 0) {
    console.error(`   Error: duplicate object keys in ${relativePath}:`);
    for (const duplicate of duplicates.slice(0, 10)) {
      console.error(`      - ${duplicate.path} (line ${duplicate.line})`);
    }
    return null;
  }

  const leafKeys = new Set(collectLeafPaths(JSON.parse(source)));
  return { locale, leafKeys, totalKeys: leafKeys.size };
}

function compareLocales(localeData) {
  const locales = Object.keys(localeData);
  if (locales.length < 2) return true;

  const [firstLocale, ...otherLocales] = locales;
  const firstData = localeData[firstLocale];
  let allMatch = true;

  for (const locale of otherLocales) {
    const data = localeData[locale];
    const missing = [...firstData.leafKeys].filter(
      (key) => !data.leafKeys.has(key),
    );
    const extra = [...data.leafKeys].filter(
      (key) => !firstData.leafKeys.has(key),
    );

    if (missing.length > 0 || extra.length > 0) {
      console.error(`   Error: ${locale} does not match ${firstLocale}`);
      allMatch = false;
    }
  }

  return allMatch;
}

function runTranslationCheck() {
  console.log("Translation Validation (one canonical file per locale)");
  console.log("=======================================================");

  const localeData = {};
  let allValid = true;

  for (const locale of I18N_LOCALES) {
    const result = validateLocale(locale);
    if (!result) {
      allValid = false;
      continue;
    }
    localeData[locale] = result;
    console.log(`   ${getMessagePath(locale)}: ${result.totalKeys} total keys`);
  }

  if (allValid && !compareLocales(localeData)) allValid = false;
  if (!allValid) {
    console.error("\nValidation failed.\n");
    return false;
  }

  console.log("\nAll validations passed.");
  return true;
}

if (require.main === module) {
  if (!runTranslationCheck()) process.exitCode = 1;
}

module.exports = {
  collectLeafPaths,
  compareLocales,
  findDuplicateJsonObjectKeys,
  runTranslationCheck,
  validateLocale,
};
