import { rm } from "node:fs/promises";
import { resolve } from "node:path";
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

  const files = new Map<string, Built>();
  for (const output of result.outputs)
    files.set(toUrl(output.path), { contents: output, contentType: output.type });

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
    outputs: result.outputs.filter((output) => !staleCssPaths.includes(toUrl(output.path))),
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
    await Bun.write(path, output);
    await writePrecompressed(path, output);
  }
}
