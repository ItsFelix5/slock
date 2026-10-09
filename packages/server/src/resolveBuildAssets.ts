const HASH_SUFFIX = /-[^-.]+\.js$/;

const DYNAMIC_IMPORT = /import\("(\.\/[^"]+\.js)"\)/g;
const STATIC_IMPORT = /(?:from|import)\s*"(\.\/[^"]+\.js)"/g;

function matches(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(pattern), (match) => `/assets/${match[1].slice(2)}`);
}

async function collectStartupChunks(
  outputs: Awaited<ReturnType<typeof Bun.build>>["outputs"],
  toUrl: (path: string) => string,
  entryPath: string,
): Promise<string[]> {
  const sources = new Map<string, Blob>();
  for (const output of outputs)
    if (output.path.endsWith(".js")) sources.set(toUrl(output.path), output);
  const seen = new Set<string>();
  const visit = async (path: string, followDynamic: boolean): Promise<void> => {
    if (seen.has(path)) return;
    const blob = sources.get(path);
    if (!blob) return;
    seen.add(path);
    const text = await blob.text();
    for (const dep of matches(text, STATIC_IMPORT)) await visit(dep, false);
    if (followDynamic) for (const dep of matches(text, DYNAMIC_IMPORT)) await visit(dep, false);
  };
  await visit(entryPath, true);
  seen.delete(entryPath);
  return [...seen];
}

export async function resolveBuildAssets(
  outputs: Awaited<ReturnType<typeof Bun.build>>["outputs"],
  toUrl: (path: string) => string,
) {
  let entryPath = "";
  const cssOutputs: string[] = [];
  for (const output of outputs) {
    const path = toUrl(output.path);
    if (output.kind === "entry-point") entryPath = path;
    if (output.path.endsWith(".css")) cssOutputs.push(path);
  }
  if (!entryPath) throw new Error("Build produced no entry point");

  const entryStem = entryPath.split("/").pop()?.replace(HASH_SUFFIX, "");
  const entryCssPaths = cssOutputs.filter((path) =>
    path.split("/").pop()?.startsWith(`${entryStem}-`),
  );
  const staleCssPaths = cssOutputs.filter((path) => !entryCssPaths.includes(path));

  return {
    entryPath,
    entryCssPaths,
    preloadPaths: await collectStartupChunks(outputs, toUrl, entryPath),
    staleCssPaths,
  };
}
