import js from "@eslint/js";
import tseslint from "typescript-eslint";
import { builtinModules } from "node:module";

export const clientImportRules = {
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: [
            ...builtinModules,
            "node:*",
            "next",
            "next/*",
            "server-only",
            "@prisma/*",
            "@clerk/*",
            "@neondatabase/*",
            "@treido/web",
            "@treido/web/*",
            "**/apps/**",
          ],
          message:
            "Shared contracts and native code must remain client-safe and independent of the web server.",
        },
      ],
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.next-parity/**",
      "**/.qa/**",
      "**/.expo/**",
      "**/dist/**",
      "**/.turbo/**",
      "**/next-env.d.ts",
      "**/expo-env.d.ts",
      "**/.local/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ["packages/**/*.ts"], rules: clientImportRules },
);
