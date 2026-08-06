import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELEASE_VERIFY_COMMANDS,
  formatReleaseCommand,
  isLocalPortInUse,
  parseWranglerDryRunGzipKiB,
  runReleaseVerify,
  validateArtifactBudget,
} from "../../../scripts/quality/checks/release-verify.js";
import { getReleaseVerifyCommands } from "../../../scripts/quality/release-proof-manifest.js";
import { captureExpectedConsoleErrors } from "@/test/console";

const openServers: net.Server[] = [];

function listenOnLoopback(): Promise<{ server: net.Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (address === null || typeof address === "string") {
        server.close();
        reject(new Error("Expected TCP server address"));
        return;
      }

      openServers.push(server);
      resolve({ server, port: address.port });
    });
  });
}

afterEach(async () => {
  const servers = openServers.splice(0);
  await Promise.all(
    servers.map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        }),
    ),
  );
  vi.restoreAllMocks();
});

describe("release verify runner", () => {
  it("takes its command list directly from the release manifest", () => {
    expect(RELEASE_VERIFY_COMMANDS).toEqual(getReleaseVerifyCommands());
  });

  it("detects an occupied local port", async () => {
    const { port } = await listenOnLoopback();

    await expect(isLocalPortInUse(port, ["127.0.0.1"])).resolves.toBe(true);
  });

  it("detects an unused local port", async () => {
    const { server, port } = await listenOnLoopback();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    openServers.splice(openServers.indexOf(server), 1);

    await expect(isLocalPortInUse(port, ["127.0.0.1"])).resolves.toBe(false);
  });

  it("checks the local E2E port before launching Playwright", async () => {
    const executedCommands: string[] = [];
    const checkedPorts: number[] = [];
    const errorSpy = captureExpectedConsoleErrors(
      "release-proof cannot start local-playwright-smoke",
      "Stop the existing local server",
    );

    const status = await runReleaseVerify({
      rootDir: "/repo",
      runCommand: (step) => {
        executedCommands.push(formatReleaseCommand(step));
        return 0;
      },
      portInUse: async (port) => {
        if (port !== undefined) checkedPorts.push(port);
        return true;
      },
    });

    const playwrightCommand = RELEASE_VERIFY_COMMANDS.find(
      (step: { args: string[] }) => step.args.includes("playwright"),
    );

    expect(status).toBe(1);
    expect(playwrightCommand).toBeDefined();
    expect(playwrightCommand?.requiresFreePort).toBe(3000);
    expect(checkedPorts).toEqual([playwrightCommand?.requiresFreePort]);
    expect(executedCommands).not.toContain(
      playwrightCommand ? formatReleaseCommand(playwrightCommand) : "",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "release-proof cannot start local-playwright-smoke because localhost:3000 is already in use.",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "Stop the existing local server and rerun pnpm release:verify.",
    );

    errorSpy.mockRestore();
  });

  it("parses representative Wrangler dry-run gzip upload lines", () => {
    const samples: Array<{ output: string; expectedKiB: number }> = [
      {
        output: "Total Upload: 13662.29 KiB / gzip: 3640.63 KiB",
        expectedKiB: 3640.63,
      },
      {
        output: "Total Upload: 8423.21 KiB / gzip: 2174.32 KiB",
        expectedKiB: 2174.32,
      },
      {
        output: [
          "Uploaded showcase-website-starter (preview)",
          "Total Upload: 8423.21 KiB / gzip: 2174.32 KiB",
          "Worker startup time: 21 ms",
        ].join("\n"),
        expectedKiB: 2174.32,
      },
    ];

    for (const sample of samples) {
      expect(parseWranglerDryRunGzipKiB(sample.output)).toBe(
        sample.expectedKiB,
      );
    }
  });

  it("fails when the Wrangler dry-run artifact exceeds the hard Free-plan budget", () => {
    const errorSpy = captureExpectedConsoleErrors(
      "Cloudflare artifact budget exceeded:",
    );

    const status = validateArtifactBudget(
      {
        metric: "gzip KiB",
        limitKiB: 3000,
        preferredKiB: 2700,
        measuredArtifact: "source-checkout",
        source: "Cloudflare Workers Free gzip upload limit",
      },
      "Total Upload: 9123.00 KiB / gzip: 3000.01 KiB",
    );

    expect(status).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "Cloudflare artifact budget exceeded: 3000.01 KiB gzip > 3000 KiB.",
    );

    errorSpy.mockRestore();
  });

  it("warns but passes when the Wrangler dry-run artifact exceeds preferred headroom only", () => {
    const warnings: string[] = [];
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation((message: string) => {
        warnings.push(message);
      });

    const status = validateArtifactBudget(
      {
        metric: "gzip KiB",
        limitKiB: 3000,
        preferredKiB: 2700,
        measuredArtifact: "source-checkout",
        source: "Cloudflare Workers Free gzip upload limit",
      },
      "Total Upload: 9123.00 KiB / gzip: 2700.01 KiB",
    );

    expect(status).toBe(0);
    expect(warnings).toContain(
      "Cloudflare artifact budget warning: 2700.01 KiB gzip is above preferred 2700 KiB headroom.",
    );

    warnSpy.mockRestore();
  });

  it("uses artifact budget metadata during release verification", async () => {
    const executedBudgetSteps: string[] = [];

    const status = await runReleaseVerify({
      rootDir: "/repo",
      runCommand: (step) => {
        if (step.artifactBudget) {
          executedBudgetSteps.push(step.id);
          return {
            status: 0,
            stdout: "Total Upload: 8423.21 KiB / gzip: 2174.32 KiB",
            stderr: "",
          };
        }

        return 0;
      },
      portInUse: async () => false,
    });

    expect(status).toBe(0);
    expect(executedBudgetSteps).toEqual(["wrangler-preview-dry-run"]);
  });
});
