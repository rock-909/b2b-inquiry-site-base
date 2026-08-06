const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const ROOT = process.cwd();
const I18N_LOCALES = require("../../../i18n-locales.config").locales;
const CATALOG_MESSAGE_PACK_IDS = require("../../../messages/message-packs.json");
const MESSAGE_PACK_IDS = [...new Set(CATALOG_MESSAGE_PACK_IDS)];

const REQUIRED_PACK_FILES = MESSAGE_PACK_IDS.flatMap((packId) =>
  I18N_LOCALES.map((locale) => getPackRelativePath(packId, locale)),
);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getPackRoot(packId) {
  return packId === "base" ? "messages/base" : `messages/profiles/${packId}`;
}

function getPackRelativePath(packId, locale) {
  return path.posix.join(getPackRoot(packId), locale, "messages.json");
}

function getPackAbsolutePath(packId, locale) {
  return path.join(ROOT, getPackRelativePath(packId, locale));
}

function readJsonSource(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(filePath) {
  return JSON.parse(readJsonSource(filePath));
}

/**
 * Sibling duplicate object keys are legal-but-lossy JSON: JSON.parse keeps the
 * last value and drops earlier ones. Use TypeScript's JSON AST so content:check
 * fails instead of reporting a false "No duplicate keys found".
 */
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
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }

        const key = propertyName(property);
        const keyPath = pathPrefix === "" ? key : `${pathPrefix}.${key}`;

        if (seenKeys.has(key)) {
          const { line } = sourceFile.getLineAndCharacterOfPosition(
            property.getStart(sourceFile),
          );
          duplicates.push({
            key,
            line: line + 1,
            path: keyPath,
          });
        } else {
          seenKeys.add(key);
        }

        walk(property.initializer, keyPath);
      }

      return;
    }

    if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((element, index) => {
        const itemPath =
          pathPrefix === "" ? `[${index}]` : `${pathPrefix}[${index}]`;
        walk(element, itemPath);
      });
    }
  }

  const statement = sourceFile.statements[0];
  if (
    statement &&
    ts.isExpressionStatement(statement) &&
    statement.expression
  ) {
    walk(statement.expression, "");
  }

  return duplicates;
}

function reportDuplicateObjectKeys(label, source) {
  const duplicates = findDuplicateJsonObjectKeys(source);

  if (duplicates.length === 0) {
    return true;
  }

  console.error(`   Error: duplicate object keys in ${label}:`);
  for (const duplicate of duplicates.slice(0, 10)) {
    console.error(`      - ${duplicate.path} (line ${duplicate.line})`);
  }

  return false;
}

function collectLeafPaths(obj, prefix = "") {
  const paths = [];

  if (!isPlainObject(obj)) return paths;

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) {
      paths.push(...collectLeafPaths(value, currentPath));
    } else {
      paths.push(currentPath);
    }
  }

  return paths;
}

// Local copy: this build script cannot require the TypeScript runtime module.
// Behaviour parity with src/lib/merge-objects.ts is pinned by
// tests/unit/scripts/merge-objects-parity.test.ts — change both together.
const MERGE_BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function mergeObjects(target, source) {
  const result = { ...target };

  for (const [key, sourceValue] of Object.entries(source)) {
    if (MERGE_BLOCKED_KEYS.has(key)) continue;
    if (sourceValue === undefined) continue;
    const targetValue = result[key];

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = mergeObjects(targetValue, sourceValue);
      continue;
    }

    result[key] = sourceValue;
  }

  return result;
}

function composeCatalogMessages(locale) {
  return CATALOG_MESSAGE_PACK_IDS.reduce(
    (composed, packId) =>
      mergeObjects(composed, readJson(getPackAbsolutePath(packId, locale))),
    {},
  );
}

/**
 * Ownership packs must not share a leaf path or a parent/child path pair.
 * Runtime deep-merge would silently overwrite a whole branch; TypeScript
 * intersection types would collapse conflicting shapes to `never`.
 * Segment boundaries use `.` so `foo` conflicts with `foo.bar`, but not `foobar`.
 */
function isStrictPathPrefix(prefix, path) {
  return path.startsWith(`${prefix}.`);
}

function pathsHaveOwnershipConflict(leftPath, rightPath) {
  return (
    leftPath === rightPath ||
    isStrictPathPrefix(leftPath, rightPath) ||
    isStrictPathPrefix(rightPath, leftPath)
  );
}

function findCrossPackLeafConflictsFromMaps(packEntries) {
  const ownerByPath = new Map();
  const conflicts = [];

  for (const { packId, leafPaths } of packEntries) {
    for (const leafPath of leafPaths) {
      for (const [ownedPath, earlierPackId] of ownerByPath) {
        if (!pathsHaveOwnershipConflict(ownedPath, leafPath)) {
          continue;
        }

        conflicts.push({
          earlierPackId,
          earlierPath: ownedPath,
          laterPackId: packId,
          path: leafPath,
        });
      }

      ownerByPath.set(leafPath, packId);
    }
  }

  return conflicts;
}

function findCrossPackLeafConflicts(locale) {
  return findCrossPackLeafConflictsFromMaps(
    CATALOG_MESSAGE_PACK_IDS.map((packId) => ({
      packId,
      leafPaths: collectLeafPaths(
        readJson(getPackAbsolutePath(packId, locale)),
      ),
    })),
  );
}

function validateCrossPackOwnership(locale) {
  console.log(`\nValidating cross-pack ownership for locale: ${locale}`);
  const conflicts = findCrossPackLeafConflicts(locale);

  if (conflicts.length === 0) {
    console.log("   No cross-pack leaf ownership conflicts");
    return true;
  }

  console.error(
    `   Error: cross-pack leaf ownership conflicts for locale ${locale}:`,
  );
  for (const conflict of conflicts.slice(0, 10)) {
    const earlier =
      conflict.earlierPath === conflict.path
        ? conflict.path
        : `${conflict.earlierPath} vs ${conflict.path}`;
    console.error(
      `      - ${earlier} owned by ${conflict.earlierPackId} and ${conflict.laterPackId}`,
    );
  }

  return false;
}

function validatePackFile(packId, locale) {
  const relativePath = getPackRelativePath(packId, locale);
  const absolutePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(absolutePath)) {
    console.error(`   Error: pack file not found: ${relativePath}`);
    return false;
  }

  const source = readJsonSource(absolutePath);
  if (!reportDuplicateObjectKeys(relativePath, source)) {
    return false;
  }

  const messages = JSON.parse(source);
  const leafPaths = collectLeafPaths(messages);

  return {
    packId,
    locale,
    leafPaths: new Set(leafPaths),
    leafCount: leafPaths.length,
  };
}

function compareLeafPathSets(leftLabel, leftPaths, rightLabel, rightPaths) {
  const missingInRight = [...leftPaths].filter(
    (leafPath) => !rightPaths.has(leafPath),
  );
  const extraInRight = [...rightPaths].filter(
    (leafPath) => !leftPaths.has(leafPath),
  );

  if (missingInRight.length === 0 && extraInRight.length === 0) {
    console.log(`   ${rightLabel} matches ${leftLabel}`);
    return true;
  }

  if (missingInRight.length > 0) {
    console.error(
      `   Error: ${rightLabel} is missing ${missingInRight.length} leaf paths from ${leftLabel}:`,
    );
    missingInRight
      .slice(0, 5)
      .forEach((leafPath) => console.error(`      - ${leafPath}`));
  }

  if (extraInRight.length > 0) {
    console.error(
      `   Error: ${rightLabel} has ${extraInRight.length} extra leaf paths vs ${leftLabel}:`,
    );
    extraInRight
      .slice(0, 5)
      .forEach((leafPath) => console.error(`      - ${leafPath}`));
  }

  return false;
}

// Dormant under single-locale (en). Auto-activates when LOCALES_CONFIG gains locales — owner 2026-07-11 decision to keep.
function validatePackLocaleParity() {
  console.log("\nValidating pack locale parity...");
  let allMatch = true;

  for (const packId of MESSAGE_PACK_IDS) {
    const [firstLocale, ...otherLocales] = I18N_LOCALES;
    const first = validatePackFile(packId, firstLocale);
    if (!first) {
      allMatch = false;
      continue;
    }

    for (const locale of otherLocales) {
      const current = validatePackFile(packId, locale);
      if (!current) {
        allMatch = false;
        continue;
      }

      if (
        !compareLeafPathSets(
          `${packId}/${firstLocale}`,
          first.leafPaths,
          `${packId}/${locale}`,
          current.leafPaths,
        )
      ) {
        allMatch = false;
      }
    }
  }

  return allMatch;
}

// Dormant under single-locale (en). Auto-activates when LOCALES_CONFIG gains locales — owner 2026-07-11 decision to keep.
function validateComposedCatalogParity() {
  console.log("\nValidating composed catalog locale parity...");
  let allMatch = true;

  const [firstLocale, ...otherLocales] = I18N_LOCALES;
  const firstAllPaths = new Set(
    collectLeafPaths(composeCatalogMessages(firstLocale)),
  );

  for (const locale of otherLocales) {
    const allPaths = new Set(collectLeafPaths(composeCatalogMessages(locale)));

    if (
      !compareLeafPathSets(
        `catalog/${firstLocale}`,
        firstAllPaths,
        `catalog/${locale}`,
        allPaths,
      )
    ) {
      allMatch = false;
    }
  }

  return allMatch;
}

function validateRequiredPackFiles() {
  console.log("\nValidating required pack files...");
  let allValid = true;

  for (const relativePath of REQUIRED_PACK_FILES) {
    const absolutePath = path.join(ROOT, relativePath);
    if (!fs.existsSync(absolutePath)) {
      console.error(`   Error: required pack file not found: ${relativePath}`);
      allValid = false;
    }
  }

  if (allValid) {
    console.log(
      `   All ${REQUIRED_PACK_FILES.length} required pack files exist`,
    );
  }

  return allValid;
}

function validateLocale(locale) {
  console.log(`\nValidating composed locale: ${locale}`);

  const messages = composeCatalogMessages(locale);
  const leafKeys = collectLeafPaths(messages);
  const leafSet = new Set(leafKeys);

  console.log(`   Total keys: ${leafKeys.length}`);
  console.log("   Pack duplicate-key scan covered by validatePackFile");

  return {
    locale,
    leafKeys: leafSet,
    totalKeys: leafKeys.length,
  };
}

// Dormant under single-locale (en). Auto-activates when LOCALES_CONFIG gains locales — owner 2026-07-11 decision to keep.
function compareLocales(localeData) {
  console.log("\nComparing locales...");
  const locales = Object.keys(localeData);
  if (locales.length < 2) {
    console.log("   Only one locale found, skipping comparison");
    return true;
  }

  const [firstLocale, ...otherLocales] = locales;
  const firstData = localeData[firstLocale];
  let allMatch = true;

  for (const locale of otherLocales) {
    const data = localeData[locale];

    if (data.totalKeys !== firstData.totalKeys) {
      console.error(
        `   Error: ${locale} has ${data.totalKeys} keys, but ${firstLocale} has ${firstData.totalKeys} keys`,
      );
      allMatch = false;
      continue;
    }

    const missingInLocale = [...firstData.leafKeys].filter(
      (key) => !data.leafKeys.has(key),
    );
    const extraInLocale = [...data.leafKeys].filter(
      (key) => !firstData.leafKeys.has(key),
    );

    if (missingInLocale.length > 0) {
      console.error(
        `   Error: ${locale} is missing ${missingInLocale.length} keys:`,
      );
      missingInLocale
        .slice(0, 5)
        .forEach((key) => console.error(`      - ${key}`));
      allMatch = false;
    }

    if (extraInLocale.length > 0) {
      console.error(
        `   Error: ${locale} has ${extraInLocale.length} extra keys:`,
      );
      extraInLocale
        .slice(0, 5)
        .forEach((key) => console.error(`      - ${key}`));
      allMatch = false;
    }

    if (missingInLocale.length === 0 && extraInLocale.length === 0) {
      console.log(`   ${locale} matches ${firstLocale}`);
    }
  }

  return allMatch;
}

function runTranslationCheck() {
  console.log("Translation Validation (catalog message packs)");
  console.log("===============================================");

  let allValid = true;

  if (!validateRequiredPackFiles()) {
    allValid = false;
  }

  for (const packId of MESSAGE_PACK_IDS) {
    for (const locale of I18N_LOCALES) {
      const result = validatePackFile(packId, locale);
      if (!result) {
        allValid = false;
      }
    }
  }

  for (const locale of I18N_LOCALES) {
    if (!validateCrossPackOwnership(locale)) {
      allValid = false;
    }
  }

  if (!validatePackLocaleParity()) {
    allValid = false;
  }

  if (!validateComposedCatalogParity()) {
    allValid = false;
  }

  const localeData = {};

  for (const locale of I18N_LOCALES) {
    const result = validateLocale(locale);
    if (!result) {
      allValid = false;
    } else {
      localeData[locale] = result;
    }
  }

  if (!allValid) {
    console.error("\nValidation failed.\n");
    return false;
  }

  if (!compareLocales(localeData)) {
    console.error("\nLocales do not match.\n");
    return false;
  }

  console.log("\nAll validations passed.");
  for (const [locale, data] of Object.entries(localeData)) {
    console.log(`${locale.toUpperCase()}: ${data.totalKeys} total keys`);
  }

  return true;
}

module.exports = {
  collectLeafPaths,
  compareLocales,
  composeCatalogMessages,
  findCrossPackLeafConflicts,
  findCrossPackLeafConflictsFromMaps,
  findDuplicateJsonObjectKeys,
  mergeObjects,
  pathsHaveOwnershipConflict,
  runTranslationCheck,
  validateLocale,
};
