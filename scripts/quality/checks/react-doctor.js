const { spawnSync } = require("node:child_process");

function isCompleteCleanReport(report) {
  // diff 模式下没有变更源码的项目会被 React Doctor 省略；被跳过的项目仍算未完成。
  const hasScannedScope =
    report?.projects?.length > 0 ||
    (report?.mode === "diff" && !report.skippedProjects?.length);
  return (
    Array.isArray(report?.projects) &&
    hasScannedScope &&
    report.projects.every((project) => project.complete === true) &&
    report.summary?.errorCount === 0 &&
    report.summary?.warningCount === 0
  );
}

function runReactDoctor(args = process.argv.slice(2)) {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "react-doctor",
      ...args,
      "--json",
      "--no-score",
      "--blocking",
      "warning",
    ],
    { encoding: "utf8", timeout: 10 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
  );
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.stdout) process.stdout.write(result.stdout);
  try {
    if (result.status === 0 && isCompleteCleanReport(JSON.parse(result.stdout)))
      return 0;
  } catch {
    // 无法解析或扫描未完成都不能当成零问题。
  }
  console.error("React Doctor failed or returned an incomplete report.");
  return result.status || 1;
}

if (require.main === module) process.exitCode = runReactDoctor();
module.exports = { isCompleteCleanReport, runReactDoctor };
