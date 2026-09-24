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

    /*
      Pages saved out of a browser. "Save page as" leaves a .html and a
      matching _files folder holding whatever scripts that page shipped -
      minified, third-party, and nothing to do with this project. Reading
      the Supabase dashboard left three of them here and they contributed
      over a thousand lint errors between them.

      Git and Vercel ignore them too; this is the third place that has to
      know, because eslint keeps its own list.
    */
    "**/*_files/**",
  ]),
  {
    // Tests build "a row saved before `base` existed" by destructuring the
    // key away, which reads as an unused variable and is exactly the intent.
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { ignoreRestSiblings: true }],
    },
  },
]);

export default eslintConfig;
