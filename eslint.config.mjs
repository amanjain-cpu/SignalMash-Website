import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";

export default defineConfig([
  globalIgnores([
    ".next/**",
    "out/**",
    "next-env.d.ts",
    /* The raw Webflow capture and the mirrored Webflow JS: third-party, minified, not ours. */
    "capture/**",
    "public/**",
    "scripts/.scratch/**",
    "tests/.output/**",
    "tests/.report/**",
  ]),
  ...next,
]);
