import { expect, test } from "bun:test";
import ts from "typescript";
import { rawLazyImports } from "../../scripts/rules/rawLazy.ts";

function count(text: string): number {
  return rawLazyImports(ts.createSourceFile("x.ts", text, ts.ScriptTarget.Latest, true)).length;
}

test("importing lazy from solid is flagged", () => {
  expect(count(`import { lazy } from "solid-js";`)).toBe(1);
});

test("an aliased lazy import is flagged", () => {
  expect(count(`import { lazy as defer, For } from "solid-js";`)).toBe(1);
});

test("other solid imports and lazyChunk are allowed", () => {
  expect(
    count(`import { For } from "solid-js";\nimport { lazyChunk } from "@slock/core/solid";`),
  ).toBe(0);
});
