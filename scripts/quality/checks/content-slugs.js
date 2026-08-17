const fs = require("node:fs");
const path = require("node:path");
const matter = require("gray-matter");
const yaml = require("js-yaml");

const FALLBACK_LOCALES = ["en"];
const CONTENT_ROOT = "content";
const CONTENT_COLLECTION = "pages";
const CONTENT_EXTENSION = "mdx";
const REPORT_DIR = "reports";
const CONTENT_SLUG_REPORT_FILENAME = "content-slug-sync-report.json";
const REQUIRED_FRONTMATTER_STRING_FIELDS = [
  "locale",
  "title",
  "description",
  "slug",
  "publishedAt",
  "updatedAt",
];
const REQUIRED_SEO_STRING_FIELDS = ["title", "description"];
const OPTIONAL_DATE_FIELDS = ["lastReviewed"];
const PUBLIC_DIR = "public";
const DATE_FIELD_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const matterOptions = {
  engines: {
    yaml: {
      parse: (str) => yaml.load(str),
      stringify: (obj) => yaml.dump(obj),
    },
  },
};

function loadDefaultLocales(rootDir = process.cwd()) {
  const localeConfigPath = path.join(rootDir, "i18n-locales.config.js");

  if (!fs.existsSync(localeConfigPath)) {
    return FALLBACK_LOCALES;
  }

  const configSource = fs.readFileSync(localeConfigPath, "utf8");
  const localesMatch = configSource.match(/locales:\s*\[([^\]]*)\]/u);
  if (!localesMatch) {
    return FALLBACK_LOCALES;
  }

  const locales = localesMatch[1].split(",").flatMap((rawLocale) => {
    const locale = rawLocale.trim().replace(/^["']|["']$/gu, "");
    return locale ? [locale] : [];
  });

  return locales.length > 0 ? locales : FALLBACK_LOCALES;
}

const DEFAULT_LOCALES = loadDefaultLocales();

function buildKey(rootDir, filePath, locale) {
  const localeRoot = path.join(
    rootDir,
    CONTENT_ROOT,
    CONTENT_COLLECTION,
    locale,
  );
  const relative = path.relative(localeRoot, filePath);
  return `${CONTENT_ROOT}/${CONTENT_COLLECTION}/${relative.replace(/\\/g, "/")}`;
}

function parseFrontmatter(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content, matterOptions);

    if (!data || typeof data.slug !== "string") {
      return {
        slug: null,
        error: "frontmatter.slug is missing or not a string",
      };
    }

    return { slug: data.slug, error: null };
  } catch (err) {
    return { slug: null, error: `Failed to parse: ${err.message}` };
  }
}

function collectPairs(rootDir, baseLocale, targetLocale) {
  const basePattern = path.join(
    rootDir,
    CONTENT_ROOT,
    CONTENT_COLLECTION,
    baseLocale,
    `**/*.${CONTENT_EXTENSION}`,
  );
  const targetPattern = path.join(
    rootDir,
    CONTENT_ROOT,
    CONTENT_COLLECTION,
    targetLocale,
    `**/*.${CONTENT_EXTENSION}`,
  );
  const pairMap = new Map();

  for (const filePath of fs.globSync(basePattern).sort()) {
    const key = buildKey(rootDir, filePath, baseLocale);
    const entry = pairMap.get(key) || {};
    entry.basePath = filePath;
    pairMap.set(key, entry);
  }

  for (const filePath of fs.globSync(targetPattern).sort()) {
    const key = buildKey(rootDir, filePath, targetLocale);
    const entry = pairMap.get(key) || {};
    entry.targetPath = filePath;
    pairMap.set(key, entry);
  }

  return pairMap;
}

function validateLocalePair(rootDir, baseLocale, targetLocale) {
  const issues = [];
  const pairMap = collectPairs(rootDir, baseLocale, targetLocale);
  let fileCount = 0;

  const orderedPairs = Array.from(pairMap.entries()).sort(([keyA], [keyB]) =>
    keyA.localeCompare(keyB),
  );

  for (const [, { basePath, targetPath }] of orderedPairs) {
    fileCount += (basePath ? 1 : 0) + (targetPath ? 1 : 0);

    if (!basePath || !targetPath) {
      const missingLocale = !basePath ? baseLocale : targetLocale;
      const existingPath = basePath || targetPath;
      issues.push({
        type: "missing_pair",
        collection: CONTENT_COLLECTION,
        baseLocale,
        targetLocale,
        basePath,
        targetPath,
        message: `Missing ${missingLocale} counterpart for: ${path.basename(existingPath)}`,
      });
      continue;
    }

    const baseResult = parseFrontmatter(basePath);
    const targetResult = parseFrontmatter(targetPath);

    if (baseResult.error || targetResult.error) {
      issues.push({
        type: "parse_error",
        collection: CONTENT_COLLECTION,
        baseLocale,
        targetLocale,
        basePath,
        targetPath,
        message: "Failed to parse frontmatter.slug",
        error: baseResult.error || targetResult.error,
      });
      continue;
    }

    if (baseResult.slug !== targetResult.slug) {
      issues.push({
        type: "slug_mismatch",
        collection: CONTENT_COLLECTION,
        baseLocale,
        targetLocale,
        basePath,
        targetPath,
        baseSlug: baseResult.slug,
        targetSlug: targetResult.slug,
        message: `Slug mismatch: "${baseResult.slug}" (${baseLocale}) vs "${targetResult.slug}" (${targetLocale})`,
      });
    }
  }

  return {
    issues,
    pairCount: pairMap.size,
    fileCount,
  };
}

function validateMdxSlugSync(options) {
  const {
    rootDir,
    locales = DEFAULT_LOCALES,
    baseLocale = locales[0],
  } = options;
  const issues = [];
  const targetLocales = locales.filter((locale) => locale !== baseLocale);
  let totalFiles = 0;
  let totalPairs = 0;

  for (const targetLocale of targetLocales) {
    const result = validateLocalePair(rootDir, baseLocale, targetLocale);
    issues.push(...result.issues);
    totalFiles += result.fileCount;
    totalPairs += result.pairCount;
  }

  return {
    ok: issues.length === 0,
    checkedCollections: [CONTENT_COLLECTION],
    checkedLocales: locales,
    issues,
    stats: {
      totalFiles,
      totalPairs,
      missingPairs: issues.filter((issue) => issue.type === "missing_pair")
        .length,
      slugMismatches: issues.filter((issue) => issue.type === "slug_mismatch")
        .length,
      parseErrors: issues.filter((issue) => issue.type === "parse_error")
        .length,
    },
  };
}

function parseFrontmatterData(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const { data } = matter(content, matterOptions);

    return { data: data || {}, error: null };
  } catch (err) {
    return { data: {}, error: `Failed to parse: ${err.message}` };
  }
}

function pushFrontmatterIssue(issues, issue) {
  issues.push({
    ...issue,
    message: `[${issue.type}] ${issue.field}: ${issue.message}`,
  });
}

function validateFrontmatterFile({
  collection,
  expectedLocale,
  filePath,
  rootDir,
  strictFrontmatter,
}) {
  const issues = [];
  const { data, error } = parseFrontmatterData(filePath);
  const expectedSlug = path.basename(filePath, path.extname(filePath));

  if (error) {
    pushFrontmatterIssue(issues, {
      type: "invalid_field",
      collection,
      locale: expectedLocale,
      filePath,
      field: "frontmatter",
      message: error,
    });
    return issues;
  }

  for (const field of REQUIRED_FRONTMATTER_STRING_FIELDS) {
    if (!(field in data)) {
      pushFrontmatterIssue(issues, {
        type: "missing_field",
        collection,
        locale: expectedLocale,
        filePath,
        field,
        message: `${field} is required`,
      });
      continue;
    }

    if (typeof data[field] !== "string" || data[field].trim() === "") {
      pushFrontmatterIssue(issues, {
        type: "invalid_field",
        collection,
        locale: expectedLocale,
        filePath,
        field,
        message: `${field} must be a non-empty string`,
      });
    }
  }

  if (typeof data.locale === "string" && data.locale !== expectedLocale) {
    pushFrontmatterIssue(issues, {
      type: "invalid_field",
      collection,
      locale: expectedLocale,
      filePath,
      field: "locale",
      message: `locale must match directory locale "${expectedLocale}"`,
    });
  }

  if (typeof data.slug === "string" && data.slug !== expectedSlug) {
    pushFrontmatterIssue(issues, {
      type: "invalid_field",
      collection,
      locale: expectedLocale,
      filePath,
      field: "slug",
      message: `slug must match file slug "${expectedSlug}"`,
    });
  }

  for (const field of ["publishedAt", "updatedAt", ...OPTIONAL_DATE_FIELDS]) {
    if (
      field in data &&
      (typeof data[field] !== "string" || !DATE_FIELD_PATTERN.test(data[field]))
    ) {
      pushFrontmatterIssue(issues, {
        type: "invalid_field",
        collection,
        locale: expectedLocale,
        filePath,
        field,
        message: `${field} must use YYYY-MM-DD`,
      });
    }
  }

  if ("draft" in data && typeof data.draft !== "boolean") {
    pushFrontmatterIssue(issues, {
      type: "invalid_field",
      collection,
      locale: expectedLocale,
      filePath,
      field: "draft",
      message: "draft must be boolean when present",
    });
  }

  const seo =
    data.seo && typeof data.seo === "object" && !Array.isArray(data.seo)
      ? data.seo
      : {};
  for (const field of REQUIRED_SEO_STRING_FIELDS) {
    if (!(field in seo)) {
      pushFrontmatterIssue(issues, {
        type: "missing_seo_field",
        collection,
        locale: expectedLocale,
        filePath,
        field: `seo.${field}`,
        message: `seo.${field} is required`,
      });
      continue;
    }

    if (typeof seo[field] !== "string" || seo[field].trim() === "") {
      pushFrontmatterIssue(issues, {
        type: "invalid_field",
        collection,
        locale: expectedLocale,
        filePath,
        field: `seo.${field}`,
        message: `seo.${field} must be a non-empty string`,
      });
    }
  }

  if (
    strictFrontmatter &&
    typeof seo.ogImage === "string" &&
    seo.ogImage.startsWith("/") &&
    !fs.existsSync(path.join(rootDir, PUBLIC_DIR, seo.ogImage.slice(1)))
  ) {
    pushFrontmatterIssue(issues, {
      type: "missing_og_image",
      collection,
      locale: expectedLocale,
      filePath,
      field: "seo.ogImage",
      message: `seo.ogImage has no file under ${PUBLIC_DIR}/: ${seo.ogImage}`,
    });
  }

  return issues;
}

function validateContentFrontmatterContract(options) {
  const {
    rootDir,
    locales = DEFAULT_LOCALES,
    strictFrontmatter = false,
  } = options;
  const issues = [];
  let totalFiles = 0;

  for (const locale of locales) {
    const pattern = path.join(
      rootDir,
      CONTENT_ROOT,
      CONTENT_COLLECTION,
      locale,
      `**/*.${CONTENT_EXTENSION}`,
    );
    for (const filePath of fs.globSync(pattern).sort()) {
      totalFiles += 1;
      issues.push(
        ...validateFrontmatterFile({
          collection: CONTENT_COLLECTION,
          expectedLocale: locale,
          filePath,
          rootDir,
          strictFrontmatter,
        }),
      );
    }
  }

  // Zero issues across zero files is a broken scan, not a clean contract.
  // Renaming a content root or a collection would otherwise report green.
  if (totalFiles === 0) {
    pushFrontmatterIssue(issues, {
      type: "invalid_field",
      collection: CONTENT_COLLECTION,
      locale: locales.join(","),
      filePath: `${CONTENT_ROOT}/${CONTENT_COLLECTION}`,
      field: "scan",
      message: `frontmatter contract scanned no .${CONTENT_EXTENSION} files under ${CONTENT_ROOT}/${CONTENT_COLLECTION}`,
    });
  }

  return {
    ok: issues.length === 0,
    checkedCollections: [CONTENT_COLLECTION],
    checkedLocales: locales,
    issues,
    stats: {
      totalFiles,
      missingFields: issues.filter((issue) => issue.type === "missing_field")
        .length,
      invalidFields: issues.filter((issue) => issue.type === "invalid_field")
        .length,
      missingSeoFields: issues.filter(
        (issue) => issue.type === "missing_seo_field",
      ).length,
      missingOgImages: issues.filter(
        (issue) => issue.type === "missing_og_image",
      ).length,
    },
  };
}

function parseContentSlugArgs(args) {
  const options = {
    json: false,
    quiet: false,
    help: false,
    strictFrontmatter: false,
    unknown: [],
  };

  for (const arg of args) {
    if (arg === "--json") {
      options.json = true;
    } else if (arg === "--quiet") {
      options.quiet = true;
    } else if (arg === "--strict-frontmatter") {
      options.strictFrontmatter = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else {
      options.unknown.push(arg);
    }
  }

  return options;
}

function printContentSlugHelp() {
  console.log(`
MDX Content Slug Sync Validator

Usage:
  node scripts/quality/checks/content-slugs.js [options]

Options:
  --json              Output JSON report to reports/content-slug-sync-report.json
  --strict-frontmatter Run opt-in frontmatter/SEO contract checks
  --quiet             Only output errors
  --help, -h          Show this help

Examples:
  node scripts/quality/checks/content-slugs.js
  node scripts/quality/checks/content-slugs.js --json
  node scripts/quality/checks/content-slugs.js --strict-frontmatter
`);
}

function printContentSlugSummary(result, options) {
  console.log("\nMDX Slug Sync Validation");
  console.log("========================\n");

  if (!options.quiet) {
    console.log(`Collections: ${result.checkedCollections.join(", ")}`);
    console.log(`Locales: ${result.checkedLocales.join(", ")}`);
    console.log(`Total files: ${result.stats.totalFiles}`);
    console.log(`Total pairs: ${result.stats.totalPairs}\n`);
  }

  if (result.ok) {
    console.log("All slug validations passed.\n");
    return;
  }

  const missingPairs = result.issues.filter(
    (issue) => issue.type === "missing_pair",
  );
  if (missingPairs.length > 0) {
    console.log(`Missing Pairs (${missingPairs.length}):`);
    for (const issue of missingPairs) {
      const existingFile = issue.basePath || issue.targetPath;
      const missingLocale = issue.basePath
        ? issue.targetLocale
        : issue.baseLocale;
      console.log(
        `   - [${issue.collection}] ${path.basename(existingFile)} (missing ${missingLocale})`,
      );
    }
    console.log("");
  }

  const slugMismatches = result.issues.filter(
    (issue) => issue.type === "slug_mismatch",
  );
  if (slugMismatches.length > 0) {
    console.log(`Slug Mismatches (${slugMismatches.length}):`);
    for (const issue of slugMismatches) {
      console.log(
        `   - [${issue.collection}] ${path.basename(issue.basePath)}`,
      );
      console.log(`     ${issue.baseLocale}: "${issue.baseSlug}"`);
      console.log(`     ${issue.targetLocale}: "${issue.targetSlug}"`);
    }
    console.log("");
  }

  const parseErrors = result.issues.filter(
    (issue) => issue.type === "parse_error",
  );
  if (parseErrors.length > 0) {
    console.log(`Parse Errors (${parseErrors.length}):`);
    for (const issue of parseErrors) {
      const file = issue.basePath || issue.targetPath;
      console.log(`   - [${issue.collection}] ${path.basename(file)}`);
      if (issue.error) console.log(`     Error: ${issue.error}`);
    }
    console.log("");
  }

  console.log("Summary:");
  console.log(`   Missing pairs: ${result.stats.missingPairs}`);
  console.log(`   Slug mismatches: ${result.stats.slugMismatches}`);
  console.log(`   Parse errors: ${result.stats.parseErrors}`);
  console.log(`   Total issues: ${result.issues.length}\n`);
}

function printFrontmatterContractSummary(result, options) {
  console.log("\nFrontmatter/SEO Contract Validation");
  console.log("===================================\n");

  if (!options.quiet) {
    console.log(`Collections: ${result.checkedCollections.join(", ")}`);
    console.log(`Locales: ${result.checkedLocales.join(", ")}`);
    console.log(`Total files: ${result.stats.totalFiles}\n`);
  }

  if (result.ok) {
    console.log("All frontmatter/SEO contract validations passed.\n");
    return;
  }

  const groups = [
    ["Missing Fields", "missing_field"],
    ["Invalid Fields", "invalid_field"],
    ["Missing SEO Fields", "missing_seo_field"],
    ["Missing OG Images", "missing_og_image"],
  ];

  for (const [label, type] of groups) {
    const groupedIssues = result.issues.filter((issue) => issue.type === type);
    if (groupedIssues.length === 0) continue;

    console.log(`${label} (${groupedIssues.length}):`);
    for (const issue of groupedIssues) {
      console.log(
        `   - [${issue.collection}/${issue.locale}] ${path.basename(issue.filePath)} ${issue.field}`,
      );
      console.log(`     ${issue.message}`);
    }
    console.log("");
  }

  console.log("Frontmatter/SEO summary:");
  console.log(`   Missing fields: ${result.stats.missingFields}`);
  console.log(`   Invalid fields: ${result.stats.invalidFields}`);
  console.log(`   Missing SEO fields: ${result.stats.missingSeoFields}`);
  console.log(`   Missing OG images: ${result.stats.missingOgImages}`);
  console.log(`   Total issues: ${result.issues.length}\n`);
}

function writeContentSlugJsonReport(result, rootDir) {
  const reportDir = path.join(rootDir, REPORT_DIR);
  const reportPath = path.join(reportDir, CONTENT_SLUG_REPORT_FILENAME);

  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        tool: "content-slug-sync",
        version: "1.0.0",
        ...result,
      },
      null,
      2,
    ),
  );
  console.log(`JSON report saved to: ${reportPath}\n`);
}

function runContentSlugCheck(args = [], rootDir = process.cwd()) {
  const options = parseContentSlugArgs(args);
  if (options.help) {
    printContentSlugHelp();
    return true;
  }
  if (options.unknown.length > 0) {
    console.error(`Error: Unknown option: ${options.unknown[0]}`);
    return false;
  }

  const result = validateMdxSlugSync({
    rootDir,
    locales: DEFAULT_LOCALES,
  });
  if (DEFAULT_LOCALES.length < 2) {
    console.log("\nMDX Slug Sync Validation");
    console.log("========================\n");
    console.log(`Collection: ${CONTENT_COLLECTION}`);
    console.log(`Locales: ${DEFAULT_LOCALES.join(", ")}`);
    console.log("Single locale site: localized slug pair comparison skipped.");
  } else {
    printContentSlugSummary(result, options);
  }
  let finalResult = result;

  if (options.strictFrontmatter) {
    const frontmatterResult = validateContentFrontmatterContract({
      rootDir,
      locales: DEFAULT_LOCALES,
      strictFrontmatter: true,
    });
    printFrontmatterContractSummary(frontmatterResult, options);

    finalResult = {
      ...result,
      ok: result.ok && frontmatterResult.ok,
      slugSync: result,
      frontmatterContract: frontmatterResult,
    };
  }

  if (options.json) writeContentSlugJsonReport(finalResult, rootDir);

  return finalResult.ok;
}

if (require.main === module) {
  if (!runContentSlugCheck(process.argv.slice(2))) process.exitCode = 1;
}

module.exports = {
  runContentSlugCheck,
  validateContentFrontmatterContract,
  validateMdxSlugSync,
  writeContentSlugJsonReport,
};
