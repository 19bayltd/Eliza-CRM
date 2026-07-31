import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

const config = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "next-env.d.ts",
      "out/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
];

export default config;
