import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELEASE_VERIFY_COMMANDS,
  isLocalPortInUse,
  runReleaseVerify,
} from "../../../scripts/quality/checks/release-verify.js";
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
  it("uses the requested deployment environment for dry-run", async () => {
    const commands: string[][] = [];
    await runReleaseVerify({
      environment: "production",
      runCommand: (step) => {
        commands.push(step.args);
        return 0;
      },
      portInUse: async () => false,
    });
    expect(commands.at(-1)).toEqual([
      "exec",
      "wrangler",
      "deploy",
      "--dry-run",
      "--env",
      "production",
    ]);
    await expect(runReleaseVerify({ environment: "invalid" })).rejects.toThrow(
      "Unsupported release environment",
    );
  });
  it("checks test TypeScript after production TypeScript", () => {
    const productionTypeCheck = RELEASE_VERIFY_COMMANDS.findIndex(
      (step) => step.id === "type-check",
    );
    const testTypeCheck = RELEASE_VERIFY_COMMANDS.findIndex(
      (step) => step.id === "test-type-check",
    );

    expect(productionTypeCheck).toBeGreaterThanOrEqual(0);
    expect(testTypeCheck).toBeGreaterThan(productionTypeCheck);
  });

  it("checks whole-repository formatting before tests", () => {
    const formatCheck = RELEASE_VERIFY_COMMANDS.findIndex(
      (step) => step.id === "format-check",
    );
    const tests = RELEASE_VERIFY_COMMANDS.findIndex(
      (step) => step.id === "tests",
    );

    expect(formatCheck).toBeGreaterThanOrEqual(0);
    expect(tests).toBeGreaterThan(formatCheck);
  });

  it("checks prerendered metadata after Next build and before OpenNext build", () => {
    const nextBuild = RELEASE_VERIFY_COMMANDS.findIndex(
      (step) => step.id === "next-build",
    );
    const prerenderStatic = RELEASE_VERIFY_COMMANDS.findIndex(
      (step) => step.id === "prerender-static",
    );
    const cloudflareBuild = RELEASE_VERIFY_COMMANDS.findIndex(
      (step) => step.id === "cloudflare-build",
    );

    expect(prerenderStatic).toBeGreaterThan(nextBuild);
    expect(prerenderStatic).toBeLessThan(cloudflareBuild);
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
        executedCommands.push(step.id);
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
    expect(executedCommands).not.toContain(playwrightCommand?.id);
    expect(errorSpy).toHaveBeenCalledWith(
      "release-proof cannot start local-playwright-smoke because localhost:3000 is already in use.",
    );
    expect(errorSpy).toHaveBeenCalledWith(
      "Stop the existing local server and rerun pnpm release:verify.",
    );

    errorSpy.mockRestore();
  });

  it("stops at the first failed command and propagates its status", async () => {
    const executedCommands: string[] = [];
    const firstStep = RELEASE_VERIFY_COMMANDS[0];

    expect(firstStep).toBeDefined();

    const status = await runReleaseVerify({
      rootDir: "/repo",
      runCommand: (step) => {
        executedCommands.push(step.id);
        return 17;
      },
      portInUse: async () => false,
    });

    expect(status).toBe(17);
    expect(executedCommands).toEqual([firstStep?.id]);
  });

  it("checks fresh build artifacts before dry-run and propagates dry-run failure", async () => {
    const executed: string[] = [];
    const status = await runReleaseVerify({
      runCommand: (step) => {
        executed.push(step.id);
        return step.id === "wrangler-dry-run" ? 23 : 0;
      },
      portInUse: async () => false,
    });
    expect(status).toBe(23);
    expect(
      executed.filter((id) =>
        [
          "local-playwright-smoke",
          "next-build",
          "cloudflare-build",
          "cloudflare-artifact-config",
          "cloudflare-static-asset-headers",
          "wrangler-dry-run",
        ].includes(id),
      ),
    ).toEqual([
      "local-playwright-smoke",
      "next-build",
      "cloudflare-build",
      "cloudflare-artifact-config",
      "cloudflare-static-asset-headers",
      "wrangler-dry-run",
    ]);
  });
});
