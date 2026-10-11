import { resolve } from "node:path";
import { solidJsx } from "./solidPlugin";

const AUTHOR_SOURCE = /\.[jt]sx?$/;
const SHARED_LIBS = ["solid-js", "solid-js/*", "@slock/*", "@tanstack/solid-query"];

export async function buildPlugin(entry: string, output: string): Promise<void> {
  const result = await Bun.build({
    entrypoints: [resolve(entry)],
    external: SHARED_LIBS,
    format: "esm",
    plugins: [solidJsx(AUTHOR_SOURCE)],
    target: "browser",
  });
  const [artifact] = result.outputs;
  if (!(result.success && artifact)) throw new Error("Plugin build failed");
  await Bun.write(resolve(output), artifact);
}
