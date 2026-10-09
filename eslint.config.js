import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

// Soroscope's rule for tests: nothing fakes the network. Tests use real fixtures
// recorded from live networks (with provenance) and real endpoints. These bans
// make that a build failure instead of a convention.
const NO_MOCKS = [
  "error",
  ...["mock", "doMock", "fn", "spyOn", "stubGlobal", "stubEnv", "mocked"].map((property) => ({
    object: "vi",
    property,
    message:
      "Soroscope tests do not mock. Use a real fixture recorded by packages/test-utils or a live endpoint.",
  })),
  ...["mock", "fn", "spyOn"].map((property) => ({
    object: "jest",
    property,
    message: "Soroscope tests do not mock.",
  })),
];

export default [
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/coverage/**", "**/.next/**", "packages/test-utils/fixture-contract/**"],
  },
  {
    files: ["packages/*/src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      ...tseslint.configs["recommended-type-checked"].rules,
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
    },
  },
  {
    files: ["packages/*/tests/**/*.ts"],
    languageOptions: { parser: tsparser },
    rules: {
      "no-restricted-properties": NO_MOCKS,
    },
  },
  {
    // An MCP server speaks its protocol on stdout. A stray console.log corrupts the stream.
    files: ["packages/mcp/src/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["error"] }],
    },
  },
  prettier,
];
