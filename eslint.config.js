import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", ".tmp"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
  {
    // Context modules intentionally co-locate their Provider and the hook that
    // reads it; the fast-refresh rule cannot express that, so it is scoped off
    // here rather than suppressed inline at each export.
    files: ["src/state/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
  {
    // build/test scripts run in Node, not the browser
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: globals.node },
  },
);
