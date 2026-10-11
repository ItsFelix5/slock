import type { BunPlugin } from "bun";

const LIB_SLUGS: Record<string, string> = {
  "@slock/blockkit": "lib-blockkit",
  "@slock/core": "lib-core",
  "@slock/slack": "lib-slack",
  "@slock/core/solid": "lib-core-solid",
  "@slock/ui": "lib-ui",
  "@tanstack/solid-query": "lib-solid-query",
  "solid-js": "lib-solid-js",
  "solid-js/store": "lib-solid-js-store",
  "solid-js/web": "lib-solid-js-web",
};

const VIRTUAL_PREFIX = "virtual:lib/";
const MODULE_PREFIX = "__lib__/";
const LIB_FILTER = /^virtual:lib\//;
const ANY_FILTER = /.*/;
const HASH_SUFFIX = /-[^-.]+\.js$/;

export const libEntrypoints = Object.values(LIB_SLUGS).map((slug) => `${VIRTUAL_PREFIX}${slug}`);

const specifierBySlug = new Map(
  Object.entries(LIB_SLUGS).map(([specifier, slug]) => [slug, specifier]),
);

export const libsPlugin: BunPlugin = {
  name: "shared-libs",
  setup(build) {
    build.onResolve({ filter: LIB_FILTER }, (args) => ({
      namespace: "lib",
      path: `${MODULE_PREFIX}${args.path.slice(VIRTUAL_PREFIX.length)}`,
    }));
    build.onLoad({ filter: ANY_FILTER, namespace: "lib" }, (args) => {
      const specifier = specifierBySlug.get(args.path.slice(MODULE_PREFIX.length)) ?? "";
      const target = specifier.startsWith("solid-js")
        ? specifier
        : Bun.resolveSync(specifier, import.meta.dir);
      return { contents: `export * from "${target}";`, loader: "js" };
    });
  },
};

export function buildImportMap(
  outputs: { kind: string; path: string }[],
  toUrl: (path: string) => string,
): { imports: Record<string, string> } {
  const imports: Record<string, string> = {};
  for (const output of outputs) {
    if (output.kind !== "entry-point") continue;
    const url = toUrl(output.path);
    const slug = url.split("/").pop()?.replace(HASH_SUFFIX, "") ?? "";
    const specifier = specifierBySlug.get(slug);
    if (specifier) imports[specifier] = url;
  }
  return { imports };
}
