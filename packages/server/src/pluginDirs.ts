import { resolve } from "node:path";

export const BUILTIN_PLUGINS_DIR = resolve(import.meta.dir, "../../plugins/src");
export const OPERATOR_PLUGINS_DIR = resolve(
  Bun.env.SLOCK_PLUGINS ?? resolve(import.meta.dir, "../../../plugins"),
);
