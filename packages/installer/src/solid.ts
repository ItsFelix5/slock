import { dirname, join } from "node:path";
import { defined } from "@slock/core";
import { transformAsync } from "@solidjs/compiler";
import type { BunPlugin } from "bun";
import { RESOLVE_FROM } from "./paths";

const WORKSPACE_SOURCE =
  /\/packages\/(ui|blockkit|types|core|plugins|resource|slack)\/src\/.*\.[jt]sx?$/;

const packageDir = (name: string) => dirname(Bun.resolveSync(`${name}/package.json`, RESOLVE_FROM));

const PRODUCTION_ENTRIES: Record<string, string> = {
  "solid-js": join(packageDir("solid-js"), "dist/solid.js"),
  "@solidjs/web": join(packageDir("@solidjs/web"), "dist/web.js"),
};

export async function compileSolid(source: string, filename: string): Promise<string> {
  const { code } = await transformAsync(source, { filename, generate: "dom" });
  return code;
}

export function solidJsx(filter: RegExp): BunPlugin {
  return {
    name: "solid-jsx",
    setup(build) {
      build.onLoad({ filter }, async ({ path }) => {
        const source = await Bun.file(path).text();
        const contents = path.endsWith(".tsx") ? await compileSolid(source, path) : source;
        return { contents, loader: "ts" };
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
