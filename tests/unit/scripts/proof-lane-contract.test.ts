import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MANUAL_PROOF_LANES,
  RELEASE_VERIFY_COMMANDS,
} from "../../../scripts/quality/checks/release-verify.js";

const REPO_ROOT = path.resolve(__dirname, "../../..");
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

describe("release proof runner contract", () => {
  it("keeps runner steps uniquely identified and manual proof lanes known", () => {
    const stepIds = RELEASE_VERIFY_COMMANDS.map((step) => step.id);

    expect(RELEASE_VERIFY_COMMANDS.length).toBeGreaterThan(0);
    expect(new Set(stepIds).size).toBe(stepIds.length);

    for (const step of RELEASE_VERIFY_COMMANDS) {
      expect(step.id).toMatch(/^[a-z0-9-]+$/u);
      expect(step.command, step.id).toMatch(/^(node|pnpm)$/u);
      expect(step.args.length, step.id).toBeGreaterThan(0);
    }

    for (const lane of MANUAL_PROOF_LANES) {
      expect(VALID_RELEASE_LANES.has(lane.lane), lane.label).toBe(true);
      expect(lane.command.length, lane.label).toBeGreaterThan(0);
    }
  });

  it("runs the full Vitest suite once without a test-file registry", () => {
    const testSteps = RELEASE_VERIFY_COMMANDS.filter(
      (step) => step.command === "pnpm" && step.args[0] === "test",
    );

    expect(testSteps.map((step) => step.id)).toEqual(["tests"]);
    expect(
      RELEASE_VERIFY_COMMANDS.flatMap((step) => step.args).filter((argument) =>
        /\.test\.[jt]sx?$/u.test(argument),
      ),
    ).toEqual([]);
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
    "website:check",
  ] as const;
  const LEAF_RELEASE_SCRIPTS = ["website:build:cf"] as const;

  it("keeps release-facing package scripts wired to existing commands", () => {
    const scripts = readPackageScripts();
    for (const scriptName of LEAF_RELEASE_SCRIPTS) {
      expect(scripts[scriptName]?.trim(), scriptName).toBeTruthy();
    }

    for (const scriptName of COMPOSITE_RELEASE_SCRIPTS) {
      const command = scripts[scriptName];
      expect(
        command,
        `${scriptName} is missing from package.json`,
      ).toBeDefined();

      const nodeScripts = [...command!.matchAll(/\bnode\s+([\w./-]+)/gu)].map(
        (match) => match[1]!,
      );
      for (const scriptPath of nodeScripts) {
        expect(
          repoPathExists(scriptPath),
          `${scriptName} -> ${scriptPath}`,
        ).toBe(true);
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
        nodeScripts.length + nestedScripts.length,
        `${scriptName} reaches no check or nested script`,
      ).toBeGreaterThan(0);
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
});
