const HASH_SUFFIX = /-[^-.]+\.js$/;

export function resolveBuildAssets(
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

  return { entryPath, entryCssPaths, staleCssPaths };
}
