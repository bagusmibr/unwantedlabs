import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Mesin MP4 disalin apa adanya dan tidak boleh diubah gaya penulisannya.
    // Ia dikirim ke browser sebagai teks lewat /api/engine, bukan di-bundel.
    "engine/**",
  ]),
]);

export default eslintConfig;
