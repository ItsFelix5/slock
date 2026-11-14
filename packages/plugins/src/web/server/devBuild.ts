import { existsSync, watch } from "node:fs";
import { readdir } from "node:fs/promises";
import { APP_DIR, build } from "./build";

type Built = Awaited<ReturnType<typeof build>>;

export async function createDevBuild() {
  let pending: Promise<Built> | undefined;
  const sourceRoot = `${APP_DIR}/..`;
  const watchers = (await readdir(sourceRoot))
    .map((name) => `${sourceRoot}/${name}/src`)
    .filter((dir) => existsSync(dir))
    .map((dir) =>
      watch(dir, { recursive: true }, () => {
        pending = undefined;
      }),
    );
  return {
    close: () => {
      for (const watcher of watchers) watcher.close();
    },
    get: () => {
      pending ??= build(false).catch((error) => {
        pending = undefined;
        throw error;
      });
      return pending;
    },
  };
}
