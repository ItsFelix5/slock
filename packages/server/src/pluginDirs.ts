import { resolve } from "node:path";
import type { Manifest } from "@slock/core";

export const BUILTIN_PLUGINS_DIR = resolve(import.meta.dir, "../../plugins/src");
export const OPERATOR_PLUGINS_DIR = resolve(
  Bun.env.SLOCK_PLUGINS ?? resolve(import.meta.dir, "../../../plugins"),
);

const installed = new Set((Bun.env.SLOCK_INSTALL ?? "").split(",").filter(Boolean));
const everything = Bun.argv.includes("--dev");

export const isShippedBuiltin = ({ core, id }: Pick<Manifest, "core" | "id">) =>
  everything || core === true || installed.has(id);
