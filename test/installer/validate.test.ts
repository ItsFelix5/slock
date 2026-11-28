import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateUnits } from "../../packages/installer/src/validate";
import { unitOf, writePlugin } from "./fixtures";

let root = "";
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), "installer-validate-"));
});
afterAll(() => rmSync(root, { force: true, recursive: true }));

const client = { "client/index.tsx": "export default () => {};" };

test("a satisfied set has no errors", () => {
  const base = unitOf(writePlugin(root, "base", {}, client));
  const top = unitOf(writePlugin(root, "top", { requires: ["base"] }, client));
  expect(validateUnits([base, top])).toEqual([]);
});

test("a missing require is reported", () => {
  const lonely = unitOf(writePlugin(root, "lonely", { requires: ["ghost"] }));
  expect(validateUnits([lonely])).toEqual(["lonely requires ghost, which is not installed"]);
});

test("a boot plugin requiring a lazy one is reported", () => {
  const lazy = unitOf(writePlugin(root, "lazy", {}, client));
  const early = unitOf(writePlugin(root, "early", { boot: true, requires: ["lazy"] }, client));
  const [error] = validateUnits([lazy, early]);
  expect(error).toContain("boot plugin early requires lazy");
  expect(error).toContain("mark lazy boot or drop the require");
});

test("a boot plugin may require a server only plugin", () => {
  const server = unitOf(
    writePlugin(root, "serveronly", {}, { "server/index.ts": "export default () => {};" }),
  );
  const early = unitOf(
    writePlugin(root, "early2", { boot: true, requires: ["serveronly"] }, client),
  );
  expect(validateUnits([server, early])).toEqual([]);
});

test("a requires cycle is reported", () => {
  const a = unitOf(writePlugin(root, "ca", { requires: ["cb"] }));
  const b = unitOf(writePlugin(root, "cb", { requires: ["ca"] }));
  expect(validateUnits([a, b])[0]).toContain("requires cycle");
});
