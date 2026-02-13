module.exports = {
  extends: ["../../.eslintrc.cjs"],
  ignorePatterns: ["next-env.d.ts", "app/lib/generated/**"],
  rules: {
    // Control-plane has a lot of API glue and JSON plumbing; allow `any` locally.
    "@typescript-eslint/no-explicit-any": "off",
  },
};
