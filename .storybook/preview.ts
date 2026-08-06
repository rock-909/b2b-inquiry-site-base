import type { Preview } from "@storybook/nextjs-vite";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import { ThemeProvider } from "@/components/theme-provider";
import {
  getStorybookLocale,
  getStorybookMessages,
} from "@/lib/i18n/storybook-messages";
// Storybook config lives outside src/, and Vite does not resolve the app alias
// early enough for the global CSS import during preview builds.
// eslint-disable-next-line no-restricted-imports -- Storybook preview is outside src and needs this CSS import before app alias resolution.
import "../src/app/globals.css";

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const theme =
        context.globals.theme === "dark"
          ? "dark"
          : context.globals.theme === "light"
            ? "light"
            : "system";
      const storybookLocale = getStorybookLocale(context.globals.locale);

      return React.createElement(
        NextIntlClientProvider,
        {
          locale: storybookLocale,
          messages: getStorybookMessages(storybookLocale),
        },
        React.createElement(
          ThemeProvider,
          {
            attribute: "class",
            defaultTheme: theme,
            forcedTheme: context.globals.theme === "system" ? undefined : theme,
            enableSystem: true,
            disableTransitionOnChange: true,
          },
          React.createElement(
            "div",
            {
              className: "min-h-dvh bg-background text-foreground p-6",
            },
            React.createElement(Story),
          ),
        ),
      );
    },
  ],
  globalTypes: {
    theme: {
      description: "Site color theme",
      defaultValue: "light",
      toolbar: {
        title: "Theme",
        icon: "circlehollow",
        items: [
          { value: "light", title: "Light" },
          { value: "dark", title: "Dark" },
          { value: "system", title: "System" },
        ],
        dynamicTitle: true,
      },
    },
    locale: {
      description: "Preview locale",
      defaultValue: "en",
      toolbar: {
        title: "Locale",
        icon: "globe",
        items: [{ value: "en", title: "English" }],
        dynamicTitle: true,
      },
    },
  },
  parameters: {
    backgrounds: {
      default: "Canvas",
      options: {
        Canvas: { name: "Canvas", value: "var(--background)" },
        Muted: { name: "Muted", value: "var(--muted)" },
        Dark: { name: "Dark", value: "var(--neutral-11)" },
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    docs: {
      toc: true,
    },
  },
};

export default preview;
