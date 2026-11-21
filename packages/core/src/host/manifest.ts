import type { Manifest } from "../types";
import { isRecord } from "../util/guards";

const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

export type ManifestResult = { ok: true; manifest: Manifest } | { ok: false; errors: string[] };

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function listErrors(value: Record<string, unknown>): string[] {
  const errors: string[] = [];
  for (const key of ["provides", "requires"]) {
    if (value[key] !== undefined && !isStringList(value[key]))
      errors.push(`${key} must be a list of strings`);
  }
  for (const key of ["core", "defaultEnabled", "hidden"]) {
    if (value[key] !== undefined && typeof value[key] !== "boolean")
      errors.push(`${key} must be true or false`);
  }
  if (value.name !== undefined && typeof value.name !== "string")
    errors.push("name must be a string");
  return errors;
}

export function parseManifest(value: unknown): ManifestResult {
  if (!isRecord(value)) return { errors: ["manifest must be an object"], ok: false };
  const errors = listErrors(value);
  if (typeof value.id !== "string") errors.push("id must be a string");
  else if (!ID_PATTERN.test(value.id)) errors.push("id must be lowercase letters, digits and -");
  if (errors.length > 0 || typeof value.id !== "string") return { errors, ok: false };
  return {
    manifest: {
      core: value.core === true ? true : undefined,
      defaultEnabled: value.defaultEnabled === false ? false : undefined,
      hidden: value.hidden === true ? true : undefined,
      id: value.id,
      name: typeof value.name === "string" ? value.name : undefined,
      provides: isStringList(value.provides) ? value.provides : [],
      requires: isStringList(value.requires) ? value.requires : [],
    },
    ok: true,
  };
}

export function readManifest(value: unknown, source: string): Manifest {
  const result = parseManifest(value);
  if (!result.ok) throw new Error(`${source}: ${result.errors.join(", ")}`);
  return result.manifest;
}
