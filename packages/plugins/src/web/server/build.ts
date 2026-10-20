import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { BuildArtifact } from "bun";
import { clientPluginsPlugin } from "./clientPlugins";
import { renderIndexHtml } from "./indexHtml";
import { buildImportMap, libEntrypoints, libsPlugin } from "./libs";
import { resolveBuildAssets } from "./resolveBuildAssets";
import { solidPlugin } from "./solidPlugin";
import { writePrecompressed } from "./staticFiles";

export const APP_DIR = resolve(import.meta.dir, "../../../../app");

const INDEX_VARIANTS = [
  ["index.html", false],
  ["index.bootstrap.html", true],
] as const;

type Built = { contents: Blob; contentType: string };

const SOURCE_MAP_COMMENT = /\n\/\/# (debugId|sourceMappingURL)=.*/g;

async function withoutEmptySourceMaps(outputs: BuildArtifact[]) {
  const empty = new Set<string>();
  for (const output of outputs) {
    if (output.kind !== "sourcemap") continue;
    if (!JSON.parse(await output.text()).sources.length) empty.add(output.path);
  }
  const files: { path: string; contents: Blob }[] = [];
  for (const output of outputs) {
    if (empty.has(output.path)) continue;
    const text = empty.has(`${output.path}.map`) && (await output.text());
    files.push({
      path: output.path,
      contents: text
        ? new Blob([text.replace(SOURCE_MAP_COMMENT, "")], { type: output.type })
        : output,
    });
  }
  return files;
}

const toUrl = (path: string) => `/${path.startsWith("./") ? path.slice(2) : path}`;

function bundle(minify: boolean) {
  return Bun.build({
    entrypoints: [`${APP_DIR}/src/index.tsx`, ...libEntrypoints],
    external: ["/public/*"],
    minify,
    naming: {
      asset: "assets/[name]-[hash].[ext]",
      chunk: "assets/[name]-[hash].[ext]",
      entry: "assets/[name]-[hash].[ext]",
    },
    plugins: [solidPlugin, clientPluginsPlugin, libsPlugin],
    sourcemap: "linked",
    splitting: true,
    target: "browser",
  });
}

export async function build(minify: boolean) {
  const result = await bundle(minify).catch((error) => {
    for (const log of error?.errors ?? []) console.error(log);
    throw error;
  });

  for (const log of result.logs)
    if (!log.message.includes("pseudo-element 'highlight'")) console.error(log);
  if (!result.success) throw new Error("Build failed");

  const cleaned = await withoutEmptySourceMaps(result.outputs);
  const files = new Map<string, Built>();
  for (const { path, contents } of cleaned)
    files.set(toUrl(path), { contents, contentType: contents.type });

  const { entryPath, entryCssPaths, preloadPaths, staleCssPaths } = await resolveBuildAssets(
    result.outputs,
    toUrl,
  );
  const importMap = JSON.stringify(buildImportMap(result.outputs, toUrl));
  return {
    files,
    html: (preloadBootstrap: boolean) =>
      renderIndexHtml(entryPath, entryCssPaths, preloadPaths, preloadBootstrap, importMap),
    importMap,
    outputs: cleaned.filter(({ path }) => !staleCssPaths.includes(toUrl(path))),
  };
}

export async function writeDist() {
  await rm(`${APP_DIR}/dist`, { force: true, recursive: true });
  const { html, outputs } = await build(true);
  for (const [name, preloadBootstrap] of INDEX_VARIANTS) {
    const path = `${APP_DIR}/dist/${name}`;
    const contents = new Blob([html(preloadBootstrap)], { type: "text/html" });
    await Bun.write(path, contents);
    await writePrecompressed(path, contents);
  }
  for (const output of outputs) {
    const path = `${APP_DIR}/dist/${toUrl(output.path).slice(1)}`;
    await Bun.write(path, output.contents);
    await writePrecompressed(path, output.contents);
  }
}
