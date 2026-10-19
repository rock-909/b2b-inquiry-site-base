# Open header lazy menus without the Suspense retry throttle

The desktop language menu and the mobile sheet waited a fixed ~300 ms before first opening: React throttles the reveal of a Suspense fallback that was just committed. The two menus now start `import()` at activation time and render the loaded component from state, so no Suspense fallback commits and the wait disappears. A chunk load failure still falls back to the static native menu and language links through `LazyIslandBoundary`. Dark mode and the theme switcher are untouched. This is a user-visible timing change kept as its own PR so it can be reverted independently.

## Actual validation

Method: local production build (`pnpm build` with the Playwright webServer env), `pnpm start` on :4173, driven through chrome-devtools-axi. Click-to-DOM time is polled in-page every 2 ms (language menu: `[role=menu]` appears; mobile: `[role=dialog]` appears), 3 runs each. The base is parent commit `48c66aea`, built separately via `NEXT_DIST_DIR`.

Fast network, before -> after (ms, 3 runs):

| First open | Before | After |
| --- | --- | --- |
| Desktop menu, direct click | 324.3 / 325.3 / 329.5 | 39.3 / 32.4 / 26.9 |
| Desktop menu, hover 150 ms then click | 181.9 / 168.3 / 170 | 0.1 / 0.1 / 0.1 |
| Mobile sheet | 319.5 / 320.5 / 320.2 | 19.3 / 18.2 / 18.8 |

Slow 4G + 4x CPU, cold browser profile per run (download dominated, expected unchanged):

| First open | Before | After |
| --- | --- | --- |
| Desktop menu, direct click | 1042.7 / 1038.2 / 1059.8 | 1050.2 / 1039.5 / 1026.7 |
| Desktop menu, hover | 979.1 / 885.2 / 1022.5 | 871.2 / 893.9 / 867 |
| Mobile sheet | 876.7 / 865.3 / 912.5 | 853.1 / 842.4 / 837.4 |

Initial JS, gzip -9 of the unique scripts in the HTML: `/` 221339 -> 221504 B (+165), `/contact` 257525 -> 257690 B (+165).

Regression checks:

- `pnpm exec vitest run src/components/layout src/components/errors`: 74 passed, including `header-client-load-failure.test.tsx` (chunk load failure still falls back to the static native menu and language links).
- `pnpm exec playwright test navigation internationalization no-js-html-contract forced-colors-focus audit-navigation-regressions --project=chromium`: 31 passed (keyboard, focus trap, Escape, axe, no-JS fallbacks, language switch).
- ESLint and Prettier clean on the changed files.

Raw data and scripts: `/Users/Data/workspace/firstmate/data/b2b-lazy-islands/proof.md`. No check beyond the above was run.
