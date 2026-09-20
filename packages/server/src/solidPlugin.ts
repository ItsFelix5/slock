import type { PresetItem } from "@babel/core";
import { transformAsync } from "@babel/core";
import solidPreset from "babel-preset-solid";
import type { BunPlugin } from "bun";

const WORKSPACE_SOURCE = /\/packages\/(app|ui|blockkit|types)\/src\/.*\.[jt]sx?$/;

export const solidPlugin: BunPlugin = {
  name: "solid-jsx",
  setup(build) {
    build.onLoad({ filter: WORKSPACE_SOURCE }, async (args) => {
      const presets: PresetItem<object>[] = [["@babel/preset-typescript", {}]];
      if (args.path.endsWith(".tsx"))
        presets.push([solidPreset, { generate: "dom", hydratable: false }]);
      const result = await transformAsync(await Bun.file(args.path).text(), {
        filename: args.path,
        presets,
        babelrc: false,
        configFile: false,
        sourceMaps: "inline",
      });
      return { contents: result?.code ?? "", loader: "js" };
    });
  },
};
