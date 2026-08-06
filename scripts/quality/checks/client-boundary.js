const fs = require("node:fs");
const path = require("node:path");
const { gzipSync } = require("node:zlib");
const { parse } = require("@babel/parser");

const ROOT = process.cwd();

const BUDGET_PATH = "scripts/quality/config/client-boundary-budget.json";
const CLIENT_BOUNDARY_REPORT_PATH =
  "reports/quality/client-boundary-budget.json";
const SOURCE_ROOT = "src";
const BUDGET_VERSION = 1;
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);
const CLIENT_BOUNDARY_EXCLUDED_DIR_NAMES = new Set([
  "__fixtures__",
  "__mocks__",
  "__tests__",
  "mock",
  "mocks",
  "spec",
  "specs",
  "stories",
  "storybook",
  ".storybook",
]);
const CLIENT_BOUNDARY_EXCLUDED_FILE_PATTERN =
  /\.(?:mock|spec|stories|story|test)\.[cm]?(?:ts|tsx)$/u;

function toRepoPath(rootDir, absolutePath) {
  return path.relative(rootDir, absolutePath).split(path.sep).join("/");
}

function isClientBoundaryExcludedPath(repoPath) {
  if (repoPath.startsWith("src/test/")) return true;
  if (repoPath.startsWith("src/testing/")) return true;
  if (CLIENT_BOUNDARY_EXCLUDED_FILE_PATTERN.test(repoPath)) return true;

  return repoPath
    .split("/")
    .some((part) => CLIENT_BOUNDARY_EXCLUDED_DIR_NAMES.has(part));
}

function collectSourceFiles(rootDir) {
  const srcDir = path.join(rootDir, SOURCE_ROOT);
  const results = [];
  if (!fs.existsSync(srcDir)) return results;

  function walk(currentPath) {
    const repoPath = toRepoPath(rootDir, currentPath);
    if (isClientBoundaryExcludedPath(repoPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(currentPath, {
        withFileTypes: true,
      })) {
        walk(path.join(currentPath, entry.name));
      }
      return;
    }

    if (stats.isFile() && SOURCE_EXTENSIONS.has(path.extname(currentPath))) {
      results.push(currentPath);
    }
  }

  walk(srcDir);
  return results.sort((left, right) => left.localeCompare(right));
}

function hasTopLevelUseClientDirective(source) {
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  return ast.program.directives.some(
    (directive) => directive.value.value === "use client",
  );
}

function collectClientBoundaryFiles(rootDir = ROOT) {
  const clientBoundaries = [];

  for (const filePath of collectSourceFiles(rootDir)) {
    if (!hasTopLevelUseClientDirective(fs.readFileSync(filePath, "utf8"))) {
      continue;
    }
    clientBoundaries.push(toRepoPath(rootDir, filePath));
  }

  return clientBoundaries.sort((left, right) => left.localeCompare(right));
}

function createBudgetError(kind, message) {
  return {
    kind,
    file: BUDGET_PATH,
    message,
  };
}

function isValidBudgetShape(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    value.version === BUDGET_VERSION &&
    Array.isArray(value.allowedClientBoundaries) &&
    value.allowedClientBoundaries.every((item) => typeof item === "string")
  );
}

function readBudget(rootDir) {
  const budgetFile = path.join(rootDir, BUDGET_PATH);
  if (!fs.existsSync(budgetFile)) {
    return {
      budget: null,
      errors: [
        createBudgetError(
          "budget-missing",
          "Client boundary budget file is missing.",
        ),
      ],
    };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(budgetFile, "utf8"));
    if (!isValidBudgetShape(parsed)) {
      return {
        budget: null,
        errors: [
          createBudgetError(
            "budget-invalid",
            "Client boundary budget must define version 1 and allowedClientBoundaries.",
          ),
        ],
      };
    }

    return {
      budget: {
        version: parsed.version,
        allowedClientBoundaries: parsed.allowedClientBoundaries.toSorted(
          (left, right) => left.localeCompare(right),
        ),
      },
      errors: [],
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      budget: null,
      errors: [createBudgetError("budget-invalid-json", message)],
    };
  }
}

function writeClientBoundaryReport(rootDir, payload) {
  const reportFile = path.join(rootDir, CLIENT_BOUNDARY_REPORT_PATH);
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function createUnexpectedBoundaryErrors(clientBoundaries, budget) {
  const allowed = new Set(budget.allowedClientBoundaries);

  const errors = [];
  for (const file of clientBoundaries) {
    if (allowed.has(file)) continue;
    errors.push({
      kind: "unexpected-client-boundary",
      file,
      message: "Client boundary is not listed in the committed budget.",
    });
  }

  return errors;
}

function createStaleBoundaryErrors(clientBoundaries, budget) {
  const actual = new Set(clientBoundaries);

  const errors = [];
  for (const file of budget.allowedClientBoundaries) {
    if (actual.has(file)) continue;
    errors.push({
      kind: "stale-client-boundary",
      file,
      message:
        "Client boundary is listed in the committed budget but is not detected in src.",
    });
  }

  return errors;
}

function runClientBoundaryBudgetCheck(rootDir = ROOT) {
  const clientBoundaries = collectClientBoundaryFiles(rootDir);
  const { budget, errors: budgetErrors } = readBudget(rootDir);
  const errors = [...budgetErrors];
  let unexpectedClientBoundaries = [];
  let staleClientBoundaries = [];

  if (budget) {
    const unexpectedErrors = createUnexpectedBoundaryErrors(
      clientBoundaries,
      budget,
    );
    unexpectedClientBoundaries = unexpectedErrors.map((error) => error.file);
    errors.push(...unexpectedErrors);

    const staleErrors = createStaleBoundaryErrors(clientBoundaries, budget);
    staleClientBoundaries = staleErrors.map((error) => error.file);
    errors.push(...staleErrors);
  }

  const result = {
    status: errors.length === 0 ? "passed" : "failed",
    budgetPath: BUDGET_PATH,
    reportPath: CLIENT_BOUNDARY_REPORT_PATH,
    clientBoundaries,
    unexpectedClientBoundaries,
    staleClientBoundaries,
    errors,
  };

  writeClientBoundaryReport(rootDir, {
    createdAt: new Date().toISOString(),
    ...result,
  });

  return result;
}

const BUILD_CHUNKS_DIR = ".next/static/chunks";
const INQUIRY_FORM_SOURCE = "src/components/forms/inquiry-form.tsx";
const INQUIRY_FORM_CHUNK_MARKER = 'data-lead-path":"api-inquiry"';
const INQUIRY_FORM_MAX_RAW_BYTES = 120_000;

const FORBIDDEN_BUILD_SOURCE_PATTERNS = [
  { label: "zod", test: (source) => /(?:^|\/)zod(?:\/|$)/.test(source) },
  {
    label: "lib/env",
    test: (source) => /src\/lib\/env(?:\.|$)/.test(source),
  },
  { label: "public-trust", test: (source) => /public-trust/.test(source) },
  {
    label: "single-site",
    test: (source) => /single-site(?:-|\.|$)/.test(source),
  },
  {
    label: "inquiry-form-static-fallback",
    test: (source) => /inquiry-form-static-fallback/.test(source),
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listChunkScripts(chunksDir) {
  return fs
    .readdirSync(chunksDir)
    .filter((name) => name.endsWith(".js") && !name.endsWith(".js.map"))
    .map((name) => path.join(chunksDir, name));
}

function chunkContainsInquiryFormMarker(chunkPath) {
  return fs.readFileSync(chunkPath, "utf8").includes(INQUIRY_FORM_CHUNK_MARKER);
}

function mapReferencesInquiryFormSources(sources) {
  return sources.some((source) => source.includes(INQUIRY_FORM_SOURCE));
}

function parseChunkSourceMappingUrl(chunkSource) {
  const matches = [...chunkSource.matchAll(/\/\/# sourceMappingURL=(.+)$/gm)];
  if (matches.length === 0) {
    return {
      error:
        "InquiryForm client chunk is missing //# sourceMappingURL declaration",
    };
  }
  if (matches.length > 1) {
    return {
      error:
        "InquiryForm client chunk has multiple //# sourceMappingURL declarations",
    };
  }

  const sourceMappingUrl = matches[0][1].trim();
  if (/^(?:data:|https?:|\/\/)/i.test(sourceMappingUrl)) {
    return {
      error: `InquiryForm client chunk sourceMappingURL must be a local relative path, got "${sourceMappingUrl}"`,
    };
  }
  if (path.isAbsolute(sourceMappingUrl) || sourceMappingUrl.includes("..")) {
    return {
      error: `InquiryForm client chunk sourceMappingURL must stay inside .next/static/chunks, got "${sourceMappingUrl}"`,
    };
  }

  return { sourceMappingUrl };
}

function resolveChunkSourceMapPath(chunksDir, chunkPath, chunkSource) {
  const parsed = parseChunkSourceMappingUrl(chunkSource);
  if (parsed.error) {
    return { error: parsed.error };
  }

  const mapPath = path.resolve(
    path.dirname(chunkPath),
    parsed.sourceMappingUrl,
  );
  const relativeMapPath = path.relative(chunksDir, mapPath);
  if (relativeMapPath.startsWith("..") || path.isAbsolute(relativeMapPath)) {
    return {
      error: `InquiryForm client chunk sourceMappingURL resolves outside .next/static/chunks: ${parsed.sourceMappingUrl}`,
    };
  }
  if (!fs.existsSync(mapPath)) {
    return {
      error: `InquiryForm client chunk sourceMappingURL target does not exist: ${parsed.sourceMappingUrl}`,
    };
  }

  return { mapPath };
}

function collectForbiddenBuildSources(sources) {
  return sources.flatMap((source) =>
    FORBIDDEN_BUILD_SOURCE_PATTERNS.filter((pattern) =>
      pattern.test(source),
    ).map((pattern) => `${pattern.label}: ${source}`),
  );
}

function createBuildArtifactError(message) {
  return { error: message };
}

function collectInquiryFormBuildArtifactFindings(
  rootDir = ROOT,
  buildChunksDir = BUILD_CHUNKS_DIR,
) {
  const chunksDir = path.join(rootDir, buildChunksDir);
  if (!fs.existsSync(chunksDir)) {
    return [
      createBuildArtifactError(
        `missing Next.js client chunk output at ${buildChunksDir}; run pnpm build first`,
      ),
    ];
  }

  const inquiryChunks = listChunkScripts(chunksDir).filter((chunkPath) =>
    chunkContainsInquiryFormMarker(chunkPath),
  );
  const findings = [];

  if (inquiryChunks.length !== 1) {
    findings.push(
      createBuildArtifactError(
        inquiryChunks.length === 0
          ? `no client chunk contains InquiryForm marker ${INQUIRY_FORM_CHUNK_MARKER}`
          : `expected exactly one InquiryForm client chunk, found ${inquiryChunks.length}`,
      ),
    );
    return findings;
  }

  const chunkPath = inquiryChunks[0];
  const chunkBytes = fs.readFileSync(chunkPath);
  const chunkSource = chunkBytes.toString("utf8");
  const resolvedMap = resolveChunkSourceMapPath(
    chunksDir,
    chunkPath,
    chunkSource,
  );
  if (resolvedMap.error) {
    findings.push(createBuildArtifactError(resolvedMap.error));
    return findings;
  }

  const mapPath = resolvedMap.mapPath;
  const sources = readJson(mapPath).sources ?? [];
  if (!mapReferencesInquiryFormSources(sources)) {
    findings.push(
      createBuildArtifactError(
        `InquiryForm client chunk sourcemap does not reference ${INQUIRY_FORM_SOURCE}`,
      ),
    );
  }

  const forbiddenSources = collectForbiddenBuildSources(sources);
  for (const forbiddenSource of forbiddenSources) {
    findings.push(
      createBuildArtifactError(
        `forbidden InquiryForm client dependency in sourcemap: ${forbiddenSource}`,
      ),
    );
  }

  const rawBytes = chunkBytes.byteLength;
  if (rawBytes > INQUIRY_FORM_MAX_RAW_BYTES) {
    findings.push(
      createBuildArtifactError(
        `InquiryForm client chunk exceeds raw budget (${rawBytes} > ${INQUIRY_FORM_MAX_RAW_BYTES})`,
      ),
    );
  }

  if (findings.length > 0) {
    return findings;
  }

  return {
    status: "passed",
    reportPath: CLIENT_BOUNDARY_REPORT_PATH,
    mapPath: toRepoPath(rootDir, mapPath),
    chunkPath: toRepoPath(rootDir, chunkPath),
    rawBytes,
    gzipBytes: gzipSync(chunkBytes).length,
    forbiddenSources: [],
  };
}

function runInquiryFormBuildArtifactCheck(rootDir = ROOT) {
  const result = collectInquiryFormBuildArtifactFindings(rootDir);

  if (Array.isArray(result)) {
    writeClientBoundaryReport(rootDir, {
      createdAt: new Date().toISOString(),
      status: "failed",
      reportPath: CLIENT_BOUNDARY_REPORT_PATH,
      mode: "build-artifacts",
      findings: result,
    });
    return { status: "failed", findings: result };
  }

  writeClientBoundaryReport(rootDir, {
    createdAt: new Date().toISOString(),
    mode: "build-artifacts",
    ...result,
  });

  return result;
}

function runClientBoundaryBuildArtifactsCli(rootDir = ROOT) {
  const result = runInquiryFormBuildArtifactCheck(rootDir);

  if (result.status === "failed") {
    console.error("[client-boundary-build-artifacts] failed");
    for (const finding of result.findings) {
      console.error(`- ${finding.error}`);
    }
    return false;
  }

  console.log(
    `[client-boundary-build-artifacts] passed: ${result.chunkPath} raw=${result.rawBytes} gzip=${result.gzipBytes} forbidden=[]`,
  );
  return true;
}

function runClientBoundaryCli(argv = []) {
  if (argv.includes("--build-artifacts")) {
    return runClientBoundaryBuildArtifactsCli(ROOT);
  }

  const result = runClientBoundaryBudgetCheck(ROOT);

  console.log(
    `[client-boundary-budget] ${result.status}: ${result.clientBoundaries.length} client boundary file(s)`,
  );
  for (const error of result.errors) {
    console.log(`- ERROR ${error.file} ${error.kind}: ${error.message}`);
  }

  return result.status !== "failed";
}

module.exports = {
  BUILD_CHUNKS_DIR,
  INQUIRY_FORM_CHUNK_MARKER,
  INQUIRY_FORM_MAX_RAW_BYTES,
  INQUIRY_FORM_SOURCE,
  collectClientBoundaryFiles,
  collectForbiddenBuildSources,
  collectInquiryFormBuildArtifactFindings,
  hasTopLevelUseClientDirective,
  runClientBoundaryBudgetCheck,
  runClientBoundaryBuildArtifactsCli,
  runClientBoundaryCli,
  runInquiryFormBuildArtifactCheck,
};
