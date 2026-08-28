const fs = require("node:fs");

const remoteName = process.argv[2] ?? "";

if (remoteName !== "origin") {
  process.exit(0);
}

const pushes = fs
  .readFileSync(0, "utf8")
  .split(/\r?\n/u)
  .map((line) => line.trim().split(/\s+/u))
  .filter((fields) => fields.length >= 4);

if (pushes.some(([, , remoteRef]) => remoteRef === "refs/heads/main")) {
  console.error(
    "Direct push to origin/main is blocked. Push a feature branch and merge through CI.",
  );
  process.exit(1);
}
