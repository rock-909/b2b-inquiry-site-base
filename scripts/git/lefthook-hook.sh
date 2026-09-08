#!/bin/sh
set -eu

hook_name="$1"
shift

if [ "${LEFTHOOK:-}" = "0" ]; then
  exit 0
fi

if [ -n "${LEFTHOOK_BIN:-}" ]; then
  exec "$LEFTHOOK_BIN" run "$hook_name" "$@"
fi

if command -v lefthook >/dev/null 2>&1; then
  exec lefthook run "$hook_name" "$@"
fi

root_dir="$(git rev-parse --show-toplevel)"
worktree_bin="$root_dir/node_modules/.bin/lefthook"

if [ -x "$worktree_bin" ]; then
  exec "$worktree_bin" run "$hook_name" "$@"
fi

if command -v pnpm >/dev/null 2>&1; then
  exec pnpm --dir "$root_dir" exec lefthook run "$hook_name" "$@"
fi

echo "Cannot find Lefthook. Set LEFTHOOK_BIN, install Lefthook, or install pnpm." >&2
exit 1
