import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openSession, resolveSpec, type Session } from "../../packages/installer/src/sources";
import { parseTargets } from "../../packages/installer/src/spec";
import { writePlugin } from "./fixtures";

let root = "";
let session: Session;

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "installer-sources-"));
  session = await openSession();
  for (const id of ["one", "two", "three"]) writePlugin(root, id);
});

afterAll(async () => {
  await session.cleanup();
  rmSync(root, { force: true, recursive: true });
});

const resolveAll = async (target: string, off = false) =>
  (
    await Promise.all(parseTargets([target], off).map((spec) => resolveSpec(spec, root, session)))
  ).flat();

test("every line of a list file is installed, blanks skipped, flags honoured", async () => {
  writeFileSync(join(root, "list"), `${join(root, "one")}\n\n${join(root, "two")} --off\n`);
  const found = await resolveAll(join(root, "list"));
  expect(found.map(({ manifest, off }) => [manifest.id, off])).toEqual([
    ["one", false],
    ["two", true],
  ]);
});

test("lists can include lists and a cycle is an error", async () => {
  writeFileSync(join(root, "inner"), `${join(root, "three")}\n`);
  writeFileSync(join(root, "outer"), `${join(root, "inner")}\n${join(root, "one")}\n`);
  expect((await resolveAll(join(root, "outer"))).map(({ manifest }) => manifest.id)).toEqual([
    "three",
    "one",
  ]);
  writeFileSync(join(root, "a"), `${join(root, "b")}\n`);
  writeFileSync(join(root, "b"), `${join(root, "a")}\n`);
  await expect(resolveAll(join(root, "a"))).rejects.toThrow("list cycle");
});

test("a failing line fails the whole list", async () => {
  writeFileSync(join(root, "broken"), `${join(root, "one")}\n${join(root, "missing")}\n`);
  await expect(resolveAll(join(root, "broken"))).rejects.toThrow("nothing found");
});

test("a folder of plugins resolves every plugin in it", async () => {
  expect((await resolveAll(root)).map(({ manifest }) => manifest.id)).toEqual([
    "one",
    "three",
    "two",
  ]);
});

test("the off flag on a list applies to every line", async () => {
  writeFileSync(join(root, "all-off"), `${join(root, "one")}\n${join(root, "two")}\n`);
  expect((await resolveAll(join(root, "all-off"), true)).every(({ off }) => off)).toBe(true);
});
