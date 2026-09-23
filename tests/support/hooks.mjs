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
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "../..");
const IMAGE = /\.(?:jpe?g|png|webp|avif|gif|svg)$/i;

export function resolve(specifier, context, next) {
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
    for (const ending of [".ts", "/index.ts", ".mjs", "/index.mjs"]) {
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
