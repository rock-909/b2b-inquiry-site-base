# Change record / commit body

Exempt the Next.js release family from pnpm's default release cooldown and align `docs/技术栈.md` with reality. No dependency version or lockfile change.

- `pnpm-workspace.yaml`: `minimumReleaseAgeExclude` lists `next`, `@next/*`, `eslint-config-next`; `minimumReleaseAge` stays unset (pnpm default, non-strict).
- `pnpm-workspace.yaml`: drop the two Tailwind `allowedVersions` entries (`@tailwindcss/typography>tailwindcss`, `tailwindcss-animate>tailwindcss`); keep the three eslint-plugin entries.
- `docs/技术栈.md`: cooldown policy, the allowed-exceptions list, and the OpenNext Node proxy bundler labelled experimental.

## Executed verification (pnpm 11.24.0, serial)

- `pnpm install --frozen-lockfile`: passed; `git status` clean afterwards (pnpm-lock.yaml and pnpm-workspace.yaml unchanged).
- `pnpm install` (plain): "Already up to date"; `git status` clean (lockfile and workspace file unchanged, no auto-appended `minimumReleaseAgeExclude` entry).
- `pnpm peers check`: "No peer dependency issues found" (exit 0) with the two Tailwind entries removed. Lockfile peer ranges: `@tailwindcss/typography@0.5.20` tailwindcss `>=3.0.0 || >=4.0.0 || insiders`; `tailwindcss-animate@1.0.7` tailwindcss `>=3.0.0 || insiders`; both resolve to tailwindcss 4.3.3.
- `pnpm format:check`: "All matched files use Prettier code style!".

## Reference searches

- `minimumReleaseAge`: only `pnpm-workspace.yaml` (comment, `minimumReleaseAgeExclude`) and `docs/技术栈.md`; no explicit `minimumReleaseAge` anywhere, so the default non-strict behavior holds.
- `allowedVersions` / Tailwind peer keys: no remaining reference outside `pnpm-workspace.yaml` and the docs bullet, which lists only the three eslint plugins.
- `pnpm view <pkg>@latest peerDependencies.eslint`: eslint-plugin-import `^2 || … || ^9`, eslint-plugin-react `… || ^9.7`, eslint-plugin-jsx-a11y `… || ^9`; none declares eslint 10, so the three remaining entries are still needed.
- `turbopackRustReactCompiler`: enabled at `next.config.ts:69` and asserted in `tests/architecture/next-config-contract.test.ts`; matches the docs exception.
- miniflare alpha: `pnpm-lock.yaml` resolves `miniflare@5.20260903.0-alpha` under wrangler 4.129.0; matches the docs statement.
- OpenNext experimental: `node_modules/@opennextjs/cloudflare/dist/cli/build/build.js:68` warns "Node.js middleware support is experimental in cloudflare, and not officially maintained by OpenNext maintainers"; matches the docs statement.
