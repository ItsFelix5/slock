import { dirname } from "node:path";
import { bootModule } from "./bootModule";
import { renderIndexHtml } from "./indexHtml";
import { LIBS_ID, type LibExports, libShims, libStubs, libsModule, probeLibExports } from "./libs";
import {
  type Built,
  entryCss,
  type Outputs,
  runBuildResult,
  staticImports,
  stemOf,
  toUrl,
  withoutEmptySourceMaps,
} from "./outputs";
import { unitResolver } from "./resolve";
import { solidJsx, solidPlugin } from "./solid";
import type { Unit } from "./units";
import { virtualModule } from "./virtual";

export type ClientBuild = {
  files: Map<string, Built>;
  importMap: string;
  entry: string;
  preloads: string[];
  html(preloadBootstrap: boolean): string;
};

const NAMING = {
  asset: "assets/[name]-[hash].[ext]",
  chunk: "assets/[name]-[hash].[ext]",
};
const PLUGIN_SOURCE = /\/packages\/plugins\/src\/.*\.[jt]sx?$/;
const BOOT_ID = "slock-boot";
const VENDORED = /node_modules\//;
const NAMED_DUPLICATES = 5;

export type Base = {
  inputs: Set<string>;
  outputs: Outputs;
  stubs: Map<string, Built>;
  libsUrl: string;
  exports: LibExports;
  imports: Record<string, string>;
  stylesheets: string[];
};

export async function buildBase(minify: boolean): Promise<Base> {
  const [{ metafile, outputs }, exports] = await Promise.all([
    runBuildResult({
      entrypoints: [LIBS_ID],
      external: ["/public/*"],
      metafile: true,
      minify,
      naming: { ...NAMING, entry: "assets/libs-[hash].[ext]" },
      plugins: [solidPlugin, virtualModule(LIBS_ID, libsModule)],
      sourcemap: "linked",
      splitting: true,
      target: "browser",
    }),
    probeLibExports(),
  ]);
  const libsUrl = outputs
    .map(({ path }) => toUrl(path))
    .find((url) => url.endsWith(".js") && stemOf(url) === "libs");
  if (!libsUrl) throw new Error("Build produced no libs bundle");
  const stubs = new Map<string, Built>();
  const imports: Record<string, string> = {};
  for (const { code, specifier, url } of libStubs(exports, libsUrl)) {
    stubs.set(url, { contents: new Blob([code]), contentType: "text/javascript" });
    imports[specifier] = url;
  }
  return {
    exports,
    imports,
    inputs: new Set(Object.keys(metafile?.inputs ?? {})),
    libsUrl,
    outputs,
    stubs,
    stylesheets: entryCss(outputs, new Set(["libs"])),
  };
}

async function startupClosure(
  sources: Map<string, Blob>,
  imports: Record<string, string>,
  entry: string,
): Promise<string[]> {
  const seen = new Set<string>();
  const visit = async (url: string): Promise<void> => {
    const blob = sources.get(url);
    if (seen.has(url) || !blob) return;
    seen.add(url);
    for (const spec of staticImports(await blob.text())) {
      const next = spec.startsWith("./")
        ? `${dirname(url)}/${spec.slice(2)}`
        : spec.startsWith("/")
          ? spec
          : imports[spec];
      if (next) await visit(next);
    }
  };
  await visit(entry);
  seen.delete(entry);
  return [...seen];
}

// A module in both bundles runs twice, and instanceof across the copies silently fails.
function assertSingleCopies(shared: Set<string>, linked: string[]) {
  const doubled = linked.filter((path) => VENDORED.test(path) && shared.has(path));
  if (doubled.length === 0) return;
  const named = doubled.slice(0, NAMED_DUPLICATES).join(", ");
  throw new Error(`Bundled twice, add the import to LIB_SLUGS in installer/src/libs.ts: ${named}`);
}

export async function linkClient(units: Unit[], base: Base, minify: boolean): Promise<ClientBuild> {
  const roots = new Map(units.map((unit) => [unit.manifest.id, unit.dir]));
  const { metafile, outputs } = await runBuildResult({
    entrypoints: [BOOT_ID],
    external: [base.libsUrl],
    metafile: true,
    minify,
    naming: { ...NAMING, entry: "assets/boot-[hash].[ext]" },
    plugins: [
      libShims(base.exports, base.libsUrl),
      unitResolver(roots),
      solidJsx(PLUGIN_SOURCE),
      virtualModule(BOOT_ID, () => bootModule(units)),
    ],
    sourcemap: "linked",
    splitting: true,
    target: "browser",
  });
  assertSingleCopies(base.inputs, Object.keys(metafile?.inputs ?? {}));
  const entry = outputs.map(({ path }) => toUrl(path)).find((url) => stemOf(url) === "boot");
  if (!entry) throw new Error("Build produced no entry point");

  const files = new Map<string, Built>();
  const kept = [
    ...(await withoutEmptySourceMaps(base.outputs)),
    ...(await withoutEmptySourceMaps(outputs)),
  ];
  const stale = new Set(
    outputs
      .map(({ path }) => toUrl(path))
      .filter((url) => url.endsWith(".css") && stemOf(url) !== "boot"),
  );
  const sources = new Map<string, Blob>();
  for (const [url, { contents }] of base.stubs) {
    files.set(url, { contents, contentType: contents.type });
  }
  for (const { path, contents } of kept) {
    const url = toUrl(path);
    if (stale.has(url)) continue;
    files.set(url, { contents, contentType: contents.type });
    if (url.endsWith(".js")) sources.set(url, contents);
  }
  const { imports } = base;
  const importMap = JSON.stringify({ imports });
  const preloads = await startupClosure(sources, imports, entry);
  const stylesheets = [...base.stylesheets, ...entryCss(outputs, new Set(["boot"]))];
  const parts = { entry, importMap, preloads, stylesheets };
  return {
    entry,
    files,
    html: (preloadBootstrap) => renderIndexHtml(parts, preloadBootstrap),
    importMap,
    preloads,
  };
}
