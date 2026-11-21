import type { BunPlugin } from "bun";

const ANY_FILE = /.*/;
const UNSAFE_NAMESPACE = /[^\w-]/g;

export function virtualModule(id: string, contents: () => string): BunPlugin {
  const exact = new RegExp(`^${id}$`);
  const namespace = id.replace(UNSAFE_NAMESPACE, "-");
  return {
    name: id,
    setup(build) {
      build.onResolve({ filter: exact }, () => ({ namespace, path: id }));
      build.onLoad({ filter: ANY_FILE, namespace }, () => ({
        contents: contents(),
        loader: "js",
      }));
    },
  };
}
