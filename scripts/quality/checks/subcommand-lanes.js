/**
 * Reconciles every `scripts/starter-checks.js` subcommand against the lanes
 * that invoke it.
 *
 * A check nobody runs is identical to a check that does not exist, except that
 * it reads as coverage. `markdown-fences` sat like that for months and was only
 * found by grepping all twenty subcommands by hand.
 *
 * WHAT THIS PROVES, EXACTLY: the subcommand appears in command position inside
 * a structurally identified lane — a workflow step's `run:`, a lefthook
 * command's `run:`, or a release-proof-manifest step. It does not observe
 * runtime execution, so a step guarded by a real `if:` condition still counts
 * as a lane; only a literally-false condition is rejected.
 *
 * Three rounds of adversarial review turned earlier versions green without
 * wiring a lane: a YAML key named `run` under `env:`, `echo "node
 * scripts/starter-checks.js foo"`, a heredoc body, a `;` inside quotes, a quote
 * spanning two lines, `\"`, a redirection target. The lesson was that patching
 * one character at a time loses. Tokenizing now follows the shell's own rules
 * in `shell-command-scan.js`; this file only decides what a parsed command
 * invokes. What that leaves:
 *
 * - Only `jobs.*.steps[].run` and lefthook `<hook>.commands.*.run` are read.
 *   A key named `run` sitting in `env:` or `with:` is not a command.
 * - A command counts only when the executor is in command position. `echo
 *   "node scripts/starter-checks.js x"` starts with `echo`, so it is text.
 * - Manual runbook lanes are reported in their own bucket. A human being told
 *   to type a command is a lane, but it is not an automated one, and the two
 *   must not be printed as the same thing.
 * - `pnpm run x` runs package script `x`; `pnpm exec x` / `npx x` run a binary
 *   named `x`. Conflating them invents lanes that do not exist.
 *
 * WHERE IT REFUSES TO GUESS. Three shapes are reported and fail the check
 * rather than returning "no lane here": a command substitution that names this
 * script, an executor that comes from a variable, and a flag on a `node` or
 * package-runner command. A silent empty answer is wrong in both directions —
 * it drops a real lane, and it also hides the case where the command names a
 * subcommand that is not registered at all. Nothing in this repo spells a lane
 * any of those ways, so the cost of demanding a plain spelling is zero today.
 *
 * WHAT IT STILL DOES NOT SEE, stated rather than papered over: reachability.
 * This reads command position. A command after a top-level `exit 0`, or inside
 * a shell branch that never runs, still counts as a lane. Closing that needs a
 * shell interpreter, and the cheap approximations are worse than the hole —
 * real steps here use `exit 1` inside `if` blocks, so "stop at the first exit"
 * would silently drop live lanes instead. `xargs` and multiplexers like
 * `concurrently "node a" "node b"` are missed the other way: the call is not
 * seen, and the subcommand is reported as an orphan.
 */

const { readFileSync, readdirSync } = require("node:fs");
const { join } = require("node:path");
const yaml = require("js-yaml");
const { scanShellCommands } = require("./shell-command-scan");

const WORKFLOW_DIR = ".github/workflows";
const LEFTHOOK_CONFIG = "lefthook.yml";
const PACKAGE_JSON = "package.json";
const STARTER_CHECKS_PATH = "scripts/starter-checks.js";
const NODE_EXECUTORS = new Set(["node"]);
const PACKAGE_RUNNERS = new Set(["pnpm", "npm", "yarn"]);
// Run a binary, not a package script. `pnpm exec node x.js` is still a real
// call, so the rest of the command is re-read as a command of its own.
const BINARY_RUNNERS = new Set(["npx", "bunx"]);
const RUNNER_EXEC_WORDS = new Set(["exec", "dlx"]);
const ENV_ASSIGNMENT = /^[A-Z_][A-Z0-9_]*=/u;

function readRepoFile(relativePath) {
  return readFileSync(relativePath, "utf8");
}

/** A step or job condition that can never be true, so it is not a lane. */
function isLiteralFalse(condition) {
  if (condition === false) return true;
  if (typeof condition !== "string") return false;

  return /^\s*(\$\{\{)?\s*false\s*(\}\})?\s*$/u.test(condition);
}

function isStarterChecksPath(token) {
  return token.replace(/^\.\//u, "") === STARTER_CHECKS_PATH;
}

function describeCommand(tokens) {
  return JSON.stringify(tokens.join(" "));
}

/**
 * `node scripts/starter-checks.js <subcommand>`.
 *
 * A flag anywhere in the command is reported rather than skipped. `node --check
 * scripts/starter-checks.js brand` only parses the file, and `-e` / `-p` never
 * read it — but returning "no lane here" also hides the opposite case, where a
 * flagged command names a subcommand that does not exist and the reconciler
 * should have said so. Nothing in this repo passes node flags to a lane, so
 * asking for a flagless spelling costs nothing.
 */
function classifyNodeCommand(tokens) {
  const flagIndex = tokens.findIndex((token) => token.startsWith("-"));
  const pathIndex = tokens.findIndex((token) => isStarterChecksPath(token));
  if (pathIndex === -1) return {};
  if (flagIndex !== -1 && flagIndex < pathIndex) {
    return {
      undecidable: `node flags before the script path: ${describeCommand(tokens)}`,
    };
  }

  const next = tokens[pathIndex + 1];
  return next && !next.startsWith("-") ? { subcommand: next } : {};
}

/**
 * `pnpm run x` / `pnpm x` name a package script. `pnpm exec x` and `npx x` run
 * a binary called `x`, which is a different thing entirely — the only case
 * worth following is when that binary is `node`.
 */
function classifyRunnerCommand(tokens, packageScripts) {
  const [target, ...rest] = tokens;
  if (!target) return {};
  // 带 flag 一律报出来，不再静默返回空。带值 flag 会吞掉下一个 token
  // （`pnpm --store-dir content:check --version` 根本没跑 content:check），
  // 而 pnpm / npm / yarn 三家的带值 flag 名单不可能同时正确——`-w` 在 pnpm
  // 是布尔、在 npm 带值。判不准就撞红：静默返回空既会漏掉真车道，也会把
  // "这条命令跑的子命令根本没注册"这种错误一起藏掉。
  if (target.startsWith("-")) {
    return {
      undecidable: `runner flags: ${describeCommand(tokens)}`,
    };
  }

  // `pnpm run <name>` — 下一个 token 就是脚本名，哪怕它自己叫 run 或 exec。
  if (target === "run") {
    const [script] = rest;
    if (script?.startsWith("-")) {
      return { undecidable: `runner flags: ${describeCommand(tokens)}` };
    }
    return script && Object.hasOwn(packageScripts, script)
      ? { packageScript: script }
      : {};
  }

  if (RUNNER_EXEC_WORDS.has(target)) {
    // 互相递归：`pnpm exec node x.js` 的后半段当成一条独立命令重新识别。
    return classifyCommand(rest, packageScripts);
  }

  return Object.hasOwn(packageScripts, target) ? { packageScript: target } : {};
}

/**
 * What one command invokes: a starter-checks subcommand, a package script,
 * neither, or something this cannot decide.
 *
 * The executor must be in command position — a path named anywhere else is
 * text, not a call.
 */
function classifyCommand(tokens, packageScripts) {
  const meaningful = tokens.filter((token) => !ENV_ASSIGNMENT.test(token));
  const [executor, ...rest] = meaningful;
  if (!executor) return {};

  // `$CMD scripts/starter-checks.js brand` runs the checker, but which binary
  // is decided at runtime. Reporting it is the only honest answer.
  if (executor.includes("$") && meaningful.some(isStarterChecksPath)) {
    return {
      undecidable: `executor comes from a variable: ${describeCommand(meaningful)}`,
    };
  }

  if (NODE_EXECUTORS.has(executor) || executor.endsWith("/node")) {
    return classifyNodeCommand(rest);
  }
  if (PACKAGE_RUNNERS.has(executor)) {
    return classifyRunnerCommand(rest, packageScripts);
  }
  if (BINARY_RUNNERS.has(executor)) {
    return classifyCommand(rest, packageScripts);
  }

  return {};
}

/** `jobs.*.steps[].run` only. A key named `run` under `env:` is not a command. */
function collectWorkflowRunStrings(workflow) {
  const found = [];

  for (const job of Object.values(workflow?.jobs ?? {})) {
    if (isLiteralFalse(job?.if)) continue;

    for (const step of job?.steps ?? []) {
      if (typeof step?.run !== "string") continue;
      if (isLiteralFalse(step?.if)) continue;
      found.push(step.run);
    }
  }

  return found;
}

/** `<hook>.commands.<name>.run` only. */
function collectLefthookRunStrings(lefthook) {
  const found = [];

  for (const hook of Object.values(lefthook ?? {})) {
    for (const command of Object.values(hook?.commands ?? {})) {
      if (typeof command?.run === "string") found.push(command.run);
    }
  }

  return found;
}

/**
 * Automated lanes something else executes, and manual lanes a human is told to
 * type. Both are lanes; only one of them runs without a person.
 *
 * `undecidable` carries every construct the scanner refused to guess at. It is
 * reported, not dropped: an unreadable command is exactly where a missing lane
 * would hide.
 */
function collectLanes() {
  const automated = [];
  const manual = [];
  const undecidable = [];

  // Commands carry the file they came from: "cannot tell what this runs" is
  // only actionable if it says where to look.
  const scanInto = (bucket, shellText, source) => {
    const scan = scanShellCommands(shellText);
    bucket.push(...scan.commands.map((tokens) => ({ tokens, source })));
    undecidable.push(
      ...scan.undecidable.map((reason) => `${source}: ${reason}`),
    );
  };

  const workflowFiles = readdirSync(WORKFLOW_DIR).filter((file) =>
    /\.ya?ml$/u.test(file),
  );
  let workflowSteps = 0;
  for (const file of workflowFiles) {
    const workflow = yaml.load(readRepoFile(join(WORKFLOW_DIR, file)));
    const runStrings = collectWorkflowRunStrings(workflow);
    workflowSteps += runStrings.length;
    for (const runString of runStrings) {
      scanInto(automated, runString, join(WORKFLOW_DIR, file));
    }
  }

  const lefthook = yaml.load(readRepoFile(LEFTHOOK_CONFIG));
  for (const runString of collectLefthookRunStrings(lefthook)) {
    scanInto(automated, runString, LEFTHOOK_CONFIG);
  }

  const { RELEASE_PROOF_MANIFEST } = require("../release-proof-manifest.js");
  for (const step of RELEASE_PROOF_MANIFEST.steps) {
    if (step.args) {
      automated.push({
        tokens: [step.command, ...step.args],
        source: "release-proof-manifest",
      });
    } else scanInto(automated, step.command, "release-proof-manifest");
  }
  for (const lane of RELEASE_PROOF_MANIFEST.manualProofLanes ?? []) {
    scanInto(manual, lane.command, "release-proof-manifest (manual)");
  }

  return { automated, manual, undecidable, workflowFiles, workflowSteps };
}

/**
 * Walk lane commands through package scripts, collecting subcommands hit.
 *
 * Anything the classifier could not decide is collected too, so a package
 * script reached from a real lane cannot hide an unreadable command.
 */
function collectReachableSubcommands(roots, packageScripts) {
  const reached = new Set();
  const undecidable = [];
  const visitedScripts = new Set();
  const queue = [...roots];

  while (queue.length > 0) {
    const { tokens, source } = queue.pop();
    const result = classifyCommand(tokens, packageScripts);

    if (result.undecidable)
      undecidable.push(`${source}: ${result.undecidable}`);
    if (result.subcommand) reached.add(result.subcommand);
    if (!result.packageScript || visitedScripts.has(result.packageScript)) {
      continue;
    }

    visitedScripts.add(result.packageScript);
    // Only the script itself. pnpm does NOT run `pre`/`post` wrappers unless
    // `enable-pre-post-scripts` is on, and this repo's `.npmrc` leaves it off
    // (pnpm 11 defaults it to false), so counting them would invent lanes: a
    // subcommand reachable only from `precheck` would read as covered while
    // nothing ever runs it. If that setting is ever turned on, a subcommand
    // living only in a pre/post script gets reported as an orphan — loudly
    // wrong in the safe direction, which is where this belongs.
    const name = result.packageScript;
    const scan = scanShellCommands(packageScripts[name]);
    const scriptSource = `package script "${name}"`;

    queue.push(
      ...scan.commands.map((tokens) => ({ tokens, source: scriptSource })),
    );
    undecidable.push(
      ...scan.undecidable.map((reason) => `${scriptSource}: ${reason}`),
    );
  }

  return { reached, undecidable };
}

/**
 * Print the findings and say whether the lane map may be trusted.
 *
 * Split out of the check so the fail-closed rule is testable on its own. It is
 * the one line this whole file exists to hold: an unreadable command is not a
 * clean result, and removing it once turned the gate green on a repo it should
 * have failed.
 *
 * `undecidable` is reported before the coverage buckets on purpose — while a
 * command is unreadable, "no orphans" is an absence of an answer, not one.
 */
function reportLaneFindings({ undecidable, orphans, unknown }) {
  for (const reason of undecidable) {
    console.error(
      `[subcommand-lanes] cannot tell what this runs — ${reason}. Spell it as a plain command, or name the subcommand where a reader can see it`,
    );
  }
  for (const command of orphans) {
    console.error(
      `[subcommand-lanes] "${command}" is registered but no lane invokes it — wire it into CI, lefthook, or the release proof manifest, or retire it`,
    );
  }
  for (const command of unknown) {
    console.error(
      `[subcommand-lanes] a lane invokes "${command}", which is not a registered subcommand — it would print usage and exit 1`,
    );
  }
  return (
    undecidable.length === 0 && orphans.length === 0 && unknown.length === 0
  );
}

function runSubcommandLaneCheck(registeredCommands) {
  const packageScripts = JSON.parse(readRepoFile(PACKAGE_JSON)).scripts ?? {};
  const {
    automated,
    manual,
    undecidable: laneUndecidable,
    workflowFiles,
    workflowSteps,
  } = collectLanes();

  // Empty-scan guard: if the parse produced nothing, the check is not clean,
  // it is blind.
  if (
    workflowFiles.length === 0 ||
    workflowSteps === 0 ||
    automated.length === 0
  ) {
    console.error(
      `[subcommand-lanes] found no runnable commands (${workflowFiles.length} workflow file(s), ${workflowSteps} step(s), ${automated.length} command(s)) — the scan is broken, not clean`,
    );
    return false;
  }
  if (!Array.isArray(registeredCommands) || registeredCommands.length === 0) {
    console.error(
      "[subcommand-lanes] the subcommand registry read back empty — the check cannot tell coverage from an empty list",
    );
    return false;
  }

  const automatedWalk = collectReachableSubcommands(automated, packageScripts);
  const manualWalk = collectReachableSubcommands(manual, packageScripts);
  const inAutomated = automatedWalk.reached;
  const inManual = manualWalk.reached;
  const manualOnly = registeredCommands.filter(
    (command) => !inAutomated.has(command) && inManual.has(command),
  );
  const orphans = registeredCommands.filter(
    (command) => !inAutomated.has(command) && !inManual.has(command),
  );
  const unknown = [...inAutomated, ...inManual].filter(
    (command) => !registeredCommands.includes(command),
  );
  const undecidable = [
    ...new Set([
      ...laneUndecidable,
      ...automatedWalk.undecidable,
      ...manualWalk.undecidable,
    ]),
  ];

  if (!reportLaneFindings({ undecidable, orphans, unknown })) return false;

  for (const command of manualOnly) {
    console.log(
      `[subcommand-lanes] "${command}" is invoked only from a manual runbook lane — a person has to type it`,
    );
  }
  console.log(
    `subcommand-lanes passed: ${registeredCommands.length} subcommand(s), ${registeredCommands.length - manualOnly.length} invoked from an automated lane, ${manualOnly.length} manual-only`,
  );
  return true;
}

module.exports = {
  runSubcommandLaneCheck,
  reportLaneFindings,
  collectReachableSubcommands,
  classifyCommand,
  collectLanes,
  collectWorkflowRunStrings,
  collectLefthookRunStrings,
};
