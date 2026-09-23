/**
 * What Node needs in order to import this project's modules directly.
 *
 * Two things only. `@/x` is the project's path alias, which tsconfig knows
 * about and Node does not. And site.ts imports the photographs themselves -
 * Next turns each one into a StaticImageData object at build time, which is
 * why a coach's portrait can be read as `c.photo.src`; outside Next they are
 * just JPEGs on disk that Node refuses to parse.
 *
 * The stub gives each image a src derived from its filename, so a test can
 * assert that a gallery tile resolved to bx-spa-jacuzzi.jpg rather than its
 * neighbour - which is exactly the bug this suite exists to catch.
 *
 * There is no transpiler here on purpose: Node strips TypeScript types on its
 * own, and `import type` is erased, so next/image never has to resolve. The
 * hooks are synchronous because registerHooks runs them in-thread.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../..");
const IMAGE = /\.(?:jpe?g|png|webp|avif|gif|svg)$/i;

/*
  The framework boundaries a test cannot cross.

  next/cache and next/navigation both reach for a per-request store that
  only exists inside a running Next server; next/link renders through the
  router. Everything else about Next - NextResponse, its request parsing -
  is used for real, because a route's status codes are the thing under test.
*/
const STUBS = new Map([
  ["next/cache", "next-cache.ts"],
  ["next/navigation", "next-navigation.ts"],
  ["next/link", "next-link.ts"],
]);

export function resolve(specifier, context, next) {
  const stub = STUBS.get(specifier);
  if (stub) {
    return next(pathToFileURL(path.join(import.meta.dirname, "stubs", stub)).href, context);
  }

  if (specifier.startsWith("@/")) {
    specifier = pathToFileURL(path.join(root, "src", specifier.slice(2))).href;
  }

  try {
    return next(specifier, context);
  } catch (error) {
    // TypeScript writes `from "./booking"` and `from "./store"`; Node wants
    // the extension, and will not take a directory. Only reached when the
    // bare specifier really does not resolve, so a genuine missing module
    // still fails - with its own error, not this one.
    const retryable = ["ERR_MODULE_NOT_FOUND", "ERR_UNSUPPORTED_DIR_IMPORT"];
    if (!retryable.includes(error?.code)) throw error;
    // ".js" is for next itself: it publishes next/server.js and friends as
    // real files with no exports map, so the bare specifier needs helping.
    for (const ending of [".ts", ".tsx", "/index.ts", ".js", "/index.js", ".mjs", "/index.mjs"]) {
      try {
        return next(specifier + ending, context);
      } catch {
        // try the next one
      }
    }
    throw error;
  }
}

export function load(url, context, next) {
  const file = new URL(url).pathname;

  /*
    Node strips TypeScript types on its own but will not touch JSX, which is
    a transform rather than an erasure. The compiler is already a dependency
    of this project, so the components are put through it here instead of
    adding a second toolchain to test them.
  */
  if (file.endsWith(".tsx")) {
    const { outputText } = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      fileName: file,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext,
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "react",
        verbatimModuleSyntax: false,
      },
    });
    return { format: "module", shortCircuit: true, source: outputText };
  }

  if (!IMAGE.test(file)) return next(url, context);

  const stub = {
    src: `/_next/static/media/${path.basename(file)}`,
    height: 1600,
    width: 1600,
    blurDataURL: "",
  };
  return {
    format: "module",
    shortCircuit: true,
    source: `export default ${JSON.stringify(stub)};`,
  };
}
