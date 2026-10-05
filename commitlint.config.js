module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "subject-max-length": [2, "always", 72],
    "subject-case": [2, "always", "lower-case"],
    "scope-case": [2, "always", "lower-case"],
  },
};
