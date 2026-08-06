import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL("../../../..", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": `${root}/src`,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [`${root}/src/test/setup.ts`],
    include: [`${root}/src/test/fixtures/console-gate/*.fixture.ts`],
  },
});
