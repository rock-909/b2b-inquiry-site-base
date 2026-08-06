---
paths:
  - "src/**/*.{ts,tsx}"
  - "tests/**/*.{ts,tsx}"
  - "scripts/**/*.{js,mjs,ts}"
  - "*config.{js,ts,mjs,mts}"
  - "package.json"
  - "pnpm-lock.yaml"
  - "eslint.config.mjs"
---

# Coding Standards

## TypeScript

Keep production code within the current `tsconfig.json` and lint boundaries;
do not weaken them incidentally.

## Naming

文件名一律 kebab-case，组件文件同理（`footer.tsx`，不是 `Footer.tsx`）。
标识符遵循 TypeScript/React 的常规命名，不在 Rules 中重复通用约定。

### 注释语言

代码注释一律用中文。

存量的中英混写不做批量重写：那是因为此前没有规则可依，不是有人违规。
这条规则只约束新写的注释。

## Imports

What eslint actually enforces (`no-restricted-imports`, `no-duplicate-imports`):

- Use the `@/` alias for cross-directory imports. Relative parent imports
  (`../*`) are a lint error — reach for `@/lib/...`, `@/components/...`, etc.
  instead. Same-folder relative imports (`./sibling`) are fine.
- Import locale-aware navigation as `{ Link }` from `@/i18n/routing`, never from
  `next/link` (lint error).
- No duplicate import statements from the same module.

Treat boundary-safe modules as part of the import contract. Middleware,
route handlers, and server-only modules must not import browser-only helpers
through convenience barrels.

## Complexity and lint exceptions

- Treat lint and complexity reports as review signals, not mechanical rewrite
  targets. Split only at a real behavior, data, platform, or security boundary.
- Keep ESLint disables narrow and name the exact rule and current reason.
- Name numeric values that carry domain meaning; keep incidental language,
  layout, and configuration literals inline when that is clearer.
- Do not add broad `memo`, `useMemo`, or `useCallback` without measured need.

## Dependency and deletion hygiene

- Treat unused dependency/export reports as leads, not deletion proof.
- Before removal, distinguish runtime, generated/tooling, governed, and truly
  unused entrypoints.
- After deleting a named surface, search configuration, tests, generated files,
  and rule routing for string references that type-checking cannot see.
- Keep a guard only while it protects live behavior or a real reintroduction
  risk.

## Quality boundaries

- Do not weaken current TypeScript, ESLint, or build gates incidentally.
- Production code must not import `src/test/**`, `src/testing/**`, or
  `src/constants/test-*`.
- Prefer deleting stale compatibility code over wrapping obsolete behavior.

## Logging

Production code uses the structured logger:

```typescript
import { logger } from "@/lib/logger";
logger.warn("Rate limit approaching", { remaining });
```

Server and client production code import `logger` from `@/lib/logger`; PII
sanitizers are server-use helpers and must not be called from Client Components.

No bare `console.*` in production code unless the file is explicitly a logger,
script, or test utility.

## Runtime assumptions

- Use Web standard APIs where they work across Next.js, Cloudflare, Vitest, and
  browser code.
- Node-only APIs belong behind explicit server/runtime boundaries.
- Do not add webpack-only behavior to application code. The current Next.js path
  is Turbopack-first; webpack configuration is a fallback boundary, not the
  source of truth for normal app behavior.

## User-facing text

All buyer-visible text belongs in content files or i18n messages, not inline
component literals, unless the string is a technical fallback that cannot be
translated safely.
