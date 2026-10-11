import { dirname, join, resolve } from "node:path";
import type { PresetItem } from "@babel/core";
import { transformAsync } from "@babel/core";
import typescriptPreset from "@babel/preset-typescript";
import { defined } from "@slock/core";
import solidPreset from "babel-preset-solid";
import type { BunPlugin } from "bun";

const WORKSPACE_SOURCE = /\/packages\/(app|ui|blockkit|types|core|plugins)\/src\/.*\.[jt]sx?$/;

const SOLID_IMPORT = /^solid-js(\/store|\/web)?$/;
const SOLID_DIR = dirname(
  Bun.resolveSync("solid-js/package.json", resolve(import.meta.dir, "../../../../app")),
);
const SOLID_PRODUCTION_ENTRIES: Record<string, string> = {
  "solid-js": join(SOLID_DIR, "dist/solid.js"),
  "solid-js/store": join(SOLID_DIR, "store/dist/store.js"),
  "solid-js/web": join(SOLID_DIR, "web/dist/web.js"),
};

export function solidJsx(filter: RegExp): BunPlugin {
  return {
    name: "solid-jsx",
    setup(build) {
      build.onLoad({ filter }, async (args) => {
        const presets: PresetItem<object>[] = [[typescriptPreset, {}]];
        if (args.path.endsWith(".tsx"))
          presets.push([solidPreset, { generate: "dom", hydratable: false }]);
        const result = await transformAsync(await Bun.file(args.path).text(), {
          babelrc: false,
          configFile: false,
          filename: args.path,
          presets,
          sourceMaps: "inline",
        });
        return { contents: result?.code ?? "", loader: "js" };
      });
    },
  };
}

export const solidPlugin: BunPlugin = {
  name: "solid-production",
  setup(build) {
    build.onResolve({ filter: SOLID_IMPORT }, (args) => ({
      path: defined(SOLID_PRODUCTION_ENTRIES[args.path]),
    }));
    solidJsx(WORKSPACE_SOURCE).setup(build);
  },
};
