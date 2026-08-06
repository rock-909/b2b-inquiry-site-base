const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const ROOTS = ["src", "tests"];
const E2E_PREFIX = path.join("tests", "e2e") + path.sep;
const TEST_FILE_PATTERN = /\.(test|spec)\.(js|jsx|ts|tsx|mts|cts)$/u;
const LIST_TIMEOUT_MS = 120 * 1000;

/**
 * `vitest.config.mts` drives collection from a hand-written include list.
 * Narrow it by one entry and `pnpm test` quietly runs fewer files while still
 * exiting 0 — measured: dropping one glob took the run from 289 files to 41,
 * green, with nothing else complaining.
 *
 * This lives outside Vitest on purpose. The first version of the check was a
 * test under `tests/architecture/`, which put the only guard for the collection
 * surface inside the surface it was guarding: deleting that directory from
 * `include` removed the guard along with everything else, silently. A check
 * cannot sit inside the thing it verifies.
 */
function collectFromDisk(dir) {
  const absolute = path.join(ROOT, dir);
  if (!fs.existsSync(absolute)) return [];

  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectFromDisk(entryPath);
    return TEST_FILE_PATTERN.test(entry.name) ? [entryPath] : [];
  });
}

function listCollectedByVitest() {
  const stdout = execFileSync(
    "pnpm",
    ["exec", "vitest", "list", "--filesOnly"],
    { cwd: ROOT, encoding: "utf8", timeout: LIST_TIMEOUT_MS },
  );

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => TEST_FILE_PATTERN.test(line))
    .map((line) => path.relative(ROOT, line));
}

function runVitestCollectionCheck() {
  const onDisk = ROOTS.flatMap((dir) => collectFromDisk(dir))
    .filter((file) => !file.startsWith(E2E_PREFIX))
    .sort();

  // Scanning nothing is a broken scan, not a clean repo.
  if (onDisk.length === 0) {
    console.error(
      `vitest-collection failed: found no test files under ${ROOTS.join(", ")}`,
    );
    return false;
  }

  let collected;
  try {
    collected = listCollectedByVitest().sort();
  } catch (error) {
    console.error(`vitest-collection failed: ${error.message}`);
    return false;
  }

  const missing = onDisk.filter((file) => !collected.includes(file));
  const unexpected = collected.filter((file) => !onDisk.includes(file));

  if (missing.length === 0 && unexpected.length === 0) {
    console.log(
      `vitest-collection passed: ${onDisk.length} test file(s), every one collected by vitest`,
    );
    return true;
  }

  console.error(
    "vitest-collection failed: vitest does not run every test file",
  );
  for (const file of missing)
    console.error(`- on disk, not collected: ${file}`);
  for (const file of unexpected) {
    console.error(`- collected, not on disk: ${file}`);
  }
  console.error(
    "Check the `include` / `exclude` globs in vitest.config.mts. A test file " +
      "nobody runs is the same as a test file nobody wrote.",
  );
  return false;
}

module.exports = { runVitestCollectionCheck, collectFromDisk };
