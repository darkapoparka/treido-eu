import { defineConfig } from "eslint/config";
import expo from "eslint-config-expo/flat.js";
import { clientImportRules } from "../../eslint.config.mjs";
export default defineConfig([
  expo,
  { ignores: ["dist/**", ".expo/**", "expo-env.d.ts"] },
  { files: ["src/**/*.{ts,tsx}"], rules: clientImportRules },
]);
