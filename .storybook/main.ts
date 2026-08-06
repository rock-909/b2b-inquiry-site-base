import { resolve } from "node:path";
import type { StorybookConfig } from "@storybook/nextjs-vite";
import { mergeConfig } from "vite";

const STORYBOOK_CHUNK_WARNING_LIMIT_KB = 1_500;

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|mdx)"],
  addons: [],
  framework: {
    name: "@storybook/nextjs-vite",
    options: {},
  },
  staticDirs: ["../public"],
  viteFinal: (viteConfig) =>
    mergeConfig(viteConfig, {
      resolve: {
        alias: {
          "@": resolve(import.meta.dirname, "../src"),
          "@content": resolve(import.meta.dirname, "../content"),
          "@messages": resolve(import.meta.dirname, "../messages"),
        },
      },
      build: {
        // Storybook's preview iframe bundles the story runtime and all stories; this
        // limit keeps production app bundle warnings separate from Storybook noise.
        chunkSizeWarningLimit: STORYBOOK_CHUNK_WARNING_LIMIT_KB,
      },
    }),
};

export default config;
