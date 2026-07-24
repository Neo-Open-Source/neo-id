import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksModule from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

const reactHooksPlugin = {
  rules: reactHooksModule.rules,
  meta: reactHooksModule.meta,
};

const webFilePatterns = [
  "packages/web/**/*.{ts,tsx}",
  "app/**/*.{ts,tsx}",
  "components/**/*.{ts,tsx}",
  "hooks/**/*.{ts,tsx}",
  "lib/**/*.{ts,tsx}",
];

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/__generated__/**",
      "**/*.config.*",
      "packages/db/prisma/generated/**",
      "packages/db/src/__generated__/**",
    ],
  },

  {
    files: webFilePatterns,
    ...reactPlugin.configs.flat.recommended,
    settings: {
      react: { version: "19.0" },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
    },
  },

  {
    files: webFilePatterns,
    plugins: {
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },

  {
    files: webFilePatterns,
    plugins: {
      "@next/next": nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
    },
  },

  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "@typescript-eslint/no-unnecessary-type-constraint": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
    },
  },
);
