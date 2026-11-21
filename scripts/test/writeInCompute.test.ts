import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writesInCompute } from "../rules/writeInCompute.ts";

const ROOT = join(import.meta.dir, "..", "..");
const cache = join(ROOT, "packages", "core", "node_modules", ".cache");
mkdirSync(cache, { recursive: true });
const dir = mkdtempSync(join(cache, "write-in-compute-"));
afterAll(() => rmSync(dir, { force: true, recursive: true }));

function lines(name: string, body: string): number[] {
  const file = join(dir, `${name}.ts`);
  writeFileSync(
    file,
    `import { createEffect, createMemo, createSignal } from "solid-js";\nconst [, set] = createSignal(0);\n${body}\n`,
  );
  return writesInCompute([file], ROOT).map((finding) => finding.line);
}

test("a setter called in a memo is flagged", () => {
  expect(lines("direct", "createMemo(() => set(1));")).toEqual([3]);
});

test("a setter reached through a helper is flagged at the call", () => {
  const body = "const bump = () => set(1);\ncreateMemo(() => bump());";
  expect(lines("helper", body)).toEqual([4]);
});

test("a write in an effect apply is allowed", () => {
  expect(lines("apply", "createEffect(() => 1, () => set(1));")).toEqual([]);
});

test("a write in an event handler is allowed", () => {
  expect(lines("handler", "const handler = () => set(1);\ncreateMemo(() => handler);")).toEqual([]);
});

test("a write after the first await is allowed", () => {
  const body = "const later = async () => { await 0; set(1); };\ncreateMemo(() => later());";
  expect(lines("awaited", body)).toEqual([]);
});

test("a write before the first await is flagged", () => {
  const body = "const early = async () => { set(1); await 0; };\ncreateMemo(() => early());";
  expect(lines("early", body)).toEqual([4]);
});
