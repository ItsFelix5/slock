import type { Manifest } from "./types";
import { isRecord } from "./util/guards";

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function parseManifest(value: unknown): Manifest {
  if (!(isRecord(value) && typeof value.id === "string"))
    throw new Error("plugin manifest needs an id");
  return {
    core: value.core === true ? true : undefined,
    defaultEnabled: value.defaultEnabled === false ? false : undefined,
    hidden: value.hidden === true ? true : undefined,
    id: value.id,
    name: typeof value.name === "string" ? value.name : undefined,
    provides: stringList(value.provides),
    requires: stringList(value.requires),
  };
}
