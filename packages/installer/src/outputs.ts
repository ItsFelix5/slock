import type { BuildArtifact } from "bun";

export type Built = { contents: Blob; contentType: string };
export type Outputs = Awaited<ReturnType<typeof Bun.build>>["outputs"];

const SOURCE_MAP_COMMENT = /\n\/\/# (debugId|sourceMappingURL)=.*/g;
const HASH_SUFFIX = /-[^-.]+\.[a-z]+$/;
const STATIC_IMPORT = /(?:from|import)\s*"([^"]+\.js|[^."/][^"]*)"/g;

export const toUrl = (path: string) => `/${path.startsWith("./") ? path.slice(2) : path}`;

export const stemOf = (url: string) => url.split("/").pop()?.replace(HASH_SUFFIX, "") ?? "";

export async function withoutEmptySourceMaps(outputs: BuildArtifact[]) {
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

export async function runBuildResult(config: Bun.BuildConfig) {
  const result = await Bun.build(config).catch((error) => {
    for (const log of error?.errors ?? []) console.error(log);
    throw error;
  });
  for (const log of result.logs)
    if (!log.message.includes("pseudo-element 'highlight'")) console.error(log);
  if (!result.success) throw new Error("Build failed");
  return result;
}

export async function runBuild(config: Bun.BuildConfig): Promise<Outputs> {
  return (await runBuildResult(config)).outputs;
}

export function entryCss(outputs: { path: string }[], entryStems: Set<string>): string[] {
  return outputs
    .map(({ path }) => toUrl(path))
    .filter((url) => url.endsWith(".css") && entryStems.has(stemOf(url)));
}

export function staticImports(source: string): string[] {
  return Array.from(source.matchAll(STATIC_IMPORT), (match) => match[1] ?? "");
}
