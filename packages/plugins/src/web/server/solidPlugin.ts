import { dirname, join, resolve } from "node:path";
import { defined } from "@slock/core";
import { transformAsync } from "@solidjs/compiler";
import type { BunPlugin } from "bun";

const WORKSPACE_SOURCE = /\/packages\/(app|ui|blockkit|types|core|plugins)\/src\/.*\.[jt]sx?$/;

const APP_DIR = resolve(import.meta.dir, "../../../../app");
const packageDir = (name: string) => dirname(Bun.resolveSync(`${name}/package.json`, APP_DIR));

/** Production entries, pinned so every workspace package shares one runtime instance. */
const PRODUCTION_ENTRIES: Record<string, string> = {
  "solid-js": join(packageDir("solid-js"), "dist/solid.js"),
  "@solidjs/web": join(packageDir("@solidjs/web"), "dist/web.js"),
};

/** Compiles Solid JSX; the compiler leaves TypeScript intact for Bun's own loader to strip. */
export function solidJsx(filter: RegExp): BunPlugin {
  return {
    name: "solid-jsx",
    setup(build) {
      build.onLoad({ filter }, async ({ path }) => {
        const source = await Bun.file(path).text();
        if (!path.endsWith(".tsx")) return { contents: source, loader: "ts" };
        const { code } = await transformAsync(source, { filename: path, generate: "dom" });
        return { contents: code, loader: "ts" };
      });
    },
  };
}

const SOLID_MODULES = /^(solid-js|@solidjs\/web)$/;

export const solidPlugin: BunPlugin = {
  name: "solid-production",
  setup(build) {
    build.onResolve({ filter: SOLID_MODULES }, ({ path }) => ({
      path: defined(PRODUCTION_ENTRIES[path]),
    }));
    solidJsx(WORKSPACE_SOURCE).setup(build);
  },
};
