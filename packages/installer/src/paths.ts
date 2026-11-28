import { join, resolve } from "node:path";

export const REPO = resolve(import.meta.dir, "../../..");
export const PACKAGES = join(REPO, "packages");
export const PLUGINS_SRC = join(REPO, "packages/plugins/src");
export const PUBLIC_DIR = join(REPO, "packages/installer/public");
export const RESOLVE_FROM = join(REPO, "packages/plugins");
