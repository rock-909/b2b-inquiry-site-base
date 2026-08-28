const { execFileSync } = require("node:child_process");

execFileSync("git", ["config", "extensions.worktreeConfig", "true"], {
  stdio: "inherit",
});
execFileSync("git", ["config", "--worktree", "core.hooksPath", ".githooks"], {
  stdio: "inherit",
});

console.log("Git hooks installed from the current worktree.");
