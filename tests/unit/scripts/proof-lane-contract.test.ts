import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { STARTER_CHECK_COMMANDS } from "../../../scripts/starter-checks.js";
import {
  RELEASE_PROOF_MANIFEST,
  getReleaseProofSequence,
} from "../../../scripts/quality/release-proof-manifest.js";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const RELEASE_PROOF_SEQUENCE = getReleaseProofSequence();
const VALID_RELEASE_LANES = new Set([
  "local/test-mode",
  "deployed-smoke",
  "airtable-write-canary",
]);

function readPackageScripts(): Record<string, string> {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
  ) as { scripts?: Record<string, string> };

  return packageJson.scripts ?? {};
}

function repoPathExists(relativePath: string): boolean {
  // eslint-disable-next-line security/detect-non-literal-fs-filename -- fixed retired path allowlist
  return fs.existsSync(path.join(REPO_ROOT, relativePath));
}

function extractDirectPnpmScript(command: string): string | null {
  const parts = command.split(/\s+/u);
  if (parts[0] !== "pnpm") return null;
  if (parts[1] === "exec") return null;
  return parts[1] ?? null;
}

describe("release proof manifest contract", () => {
  it("keeps manifest steps uniquely identified and on known proof lanes", () => {
    const stepIds = RELEASE_PROOF_MANIFEST.steps.map(
      (step: { id: string }) => step.id,
    );

    expect(RELEASE_PROOF_MANIFEST.version).toBe(1);
    expect(RELEASE_PROOF_MANIFEST.steps.length).toBeGreaterThan(0);
    expect(new Set(stepIds).size).toBe(stepIds.length);

    for (const step of RELEASE_PROOF_MANIFEST.steps) {
      expect(step.id).toMatch(/^[a-z0-9-]+$/u);
      expect(VALID_RELEASE_LANES.has(step.lane), step.id).toBe(true);
      expect(step.command, step.id).toMatch(/^(node|pnpm)$/u);
      expect(step.args.length, step.id).toBeGreaterThan(0);
    }

    for (const lane of RELEASE_PROOF_MANIFEST.manualProofLanes) {
      expect(VALID_RELEASE_LANES.has(lane.lane), lane.label).toBe(true);
      expect(lane.command.length, lane.label).toBeGreaterThan(0);
    }
  });
});

describe("package proof command surface", () => {
  // Freezing the exact command strings made a new flag look like a broken
  // wiring. Assert what the name claims instead: every check and every nested
  // pnpm script these entry points reach actually exists.
  // Composite entry points fan out to checks and other scripts; every target
  // has to resolve. `website:build:cf` is a leaf that shells straight out to
  // the OpenNext binary, so it only has to exist.
  const COMPOSITE_RELEASE_SCRIPTS = [
    "release:verify",
    "content:check",
    "component:check",
    "website:check",
  ] as const;
  const LEAF_RELEASE_SCRIPTS = ["website:build:cf"] as const;

  it("keeps release-facing package scripts wired to existing commands", () => {
    const scripts = readPackageScripts();
    const knownChecks = new Set(STARTER_CHECK_COMMANDS);

    for (const scriptName of LEAF_RELEASE_SCRIPTS) {
      expect(scripts[scriptName]?.trim(), scriptName).toBeTruthy();
    }

    for (const scriptName of COMPOSITE_RELEASE_SCRIPTS) {
      const command = scripts[scriptName];
      expect(
        command,
        `${scriptName} is missing from package.json`,
      ).toBeDefined();

      const referencedChecks = [
        ...command!.matchAll(/starter-checks\.js\s+([\w-]+)/gu),
      ].map((match) => match[1]!);
      for (const check of referencedChecks) {
        expect(knownChecks, `${scriptName} -> ${check}`).toContain(check);
      }

      const nestedScripts = [...command!.matchAll(/\bpnpm\s+([\w:-]+)/gu)]
        .map((match) => match[1]!)
        .filter((name) => name !== "exec");
      for (const nested of nestedScripts) {
        expect(scripts, `${scriptName} -> pnpm ${nested}`).toHaveProperty(
          nested,
        );
      }

      expect(
        referencedChecks.length + nestedScripts.length,
        `${scriptName} reaches no check or nested script`,
      ).toBeGreaterThan(0);
    }
  });

  it("keeps direct pnpm commands in the release sequence backed by package scripts", () => {
    const scripts = readPackageScripts();

    for (const command of RELEASE_PROOF_SEQUENCE) {
      const scriptName = extractDirectPnpmScript(command);
      if (scriptName === null) continue;
      expect(scripts, command).toHaveProperty(scriptName);
    }
  });

  it("keeps Cloudflare build scripts on the canonical platform mode", () => {
    const scripts = readPackageScripts();

    for (const scriptName of ["website:build:cf", "website:build:cf:debug"]) {
      expect(scripts[scriptName], scriptName).toMatch(
        /\bDEPLOYMENT_PLATFORM=cloudflare\b/u,
      );
      expect(scripts[scriptName], scriptName).toMatch(
        /\bNEXT_PUBLIC_DEPLOYMENT_PLATFORM=cloudflare\b/u,
      );
    }
  });

  // 保护当前公开命令面，不维护历史脚本名清单。
  it("keeps phase and mutation lanes out of public package scripts and release proof", () => {
    const scriptNames = Object.keys(readPackageScripts());
    const releaseProofFlow = RELEASE_PROOF_SEQUENCE.join("\n");

    expect(
      scriptNames.filter((name) => name.startsWith("test:mutation")),
    ).toEqual([]);
    expect(scriptNames.filter((name) => name.includes(":phase"))).toEqual([]);
    expect(releaseProofFlow).not.toMatch(/:?phase\d/u);
  });

  // 发布序列引用的 Node 脚本必须真实存在。
  it("keeps every release sequence node script pointing at a real file", () => {
    const nodeScripts = RELEASE_PROOF_SEQUENCE.flatMap(
      (command: string) => command.match(/\bnode\s+([\w./-]+)/u)?.[1] ?? [],
    );

    expect(nodeScripts.length).toBeGreaterThan(0);
    for (const scriptPath of nodeScripts) {
      expect(repoPathExists(scriptPath), scriptPath).toBe(true);
    }
  });

  // Vitest 会把不存在的路径当过滤器，因此显式确认发布序列中的测试仍存在。
  it("keeps every release sequence vitest path pointing at a real file", () => {
    const testPaths = RELEASE_PROOF_SEQUENCE.flatMap((command: string) =>
      command.includes("vitest run")
        ? command
            .split(/\s+/u)
            .filter((token: string) => /\.test\.[jt]sx?$/u.test(token))
        : [],
    );

    expect(testPaths.length).toBeGreaterThan(0);
    for (const testPath of testPaths) {
      expect(repoPathExists(testPath), testPath).toBe(true);
    }
  });
});
