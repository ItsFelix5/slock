import { expect, test } from "bun:test";
import ts from "typescript";
import { crossSideImports } from "../../scripts/rules/sideBoundary.ts";

const DIRECTORIES = new Set(["packages/slack/src/client"]);

function crosses(file: string, specifier: string): boolean {
  const source = ts.createSourceFile(file, `import "${specifier}";`, ts.ScriptTarget.Latest, true);
  return crossSideImports(source, file, (path) => DIRECTORIES.has(path)).length > 0;
}

const client = "packages/plugins/src/a/client/index.ts";
const server = "packages/plugins/src/a/server/index.ts";
const shared = "packages/plugins/src/a/protocol/index.ts";

test.each([
  [client, "../server/store"],
  [client, "@slock/core/serve"],
  [client, "node:fs"],
  [server, "../client/store"],
  [server, "@slock/slack/client"],
  [server, "@slock/plugins/b/client/api"],
  [server, "solid-js"],
  [shared, "../client/store"],
  [shared, "@slock/core/http"],
  [shared, "@slock/ui"],
  ["packages/slack/src/index.ts", "./client"],
  ["packages/ui/src/a.ts", "bun"],
  ["packages/central/src/a.ts", "@slock/core/solid"],
])("%s may not import %s", (file, specifier) => {
  expect(crosses(file, specifier)).toBe(true);
});

test.each([
  [client, "./store"],
  [client, "../protocol/index"],
  [client, "@slock/core"],
  [client, "@slock/slack/client"],
  [server, "@slock/core/services"],
  [server, "@slock/plugins/b/server/api"],
  [server, "bun:sqlite"],
  [shared, "@slock/slack"],
  ["packages/installer/src/server.ts", "./client"],
  ["packages/slack/src/client/send.ts", "../error"],
  ["packages/blockkit/src/a.ts", "@slock/ui"],
])("%s may import %s", (file, specifier) => {
  expect(crosses(file, specifier)).toBe(false);
});
