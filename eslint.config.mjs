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
    // Local design references, extracted source material, and nested checkouts.
    "pembaruan UI/**",
    "design latihan kilat bunpou/**",
    "kotoba latihan kilat design/**",
    "revisi bunpou design/**",
    "honix design brief/**",
    "ekstrak/**",
    "drive-download-*/**",
    "materi/**",
    "**/.worktrees/**",
    "**/worktrees/**",
  ]),
]);

export default eslintConfig;
