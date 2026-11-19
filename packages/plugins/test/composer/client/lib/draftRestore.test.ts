import { beforeAll, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import { parseUserId } from "@slock/slack";
import { partialService, seededRandom } from "@slock/core/testing";
import type { Services } from "@slock/core/types";
import type { Block } from "@slock/types";
import type { DeltaOp } from "../../../../src/composer/client/lib/deltaLines";
import { buildRichTextBlocks } from "../../../../src/composer/client/lib/richTextBuild";
import { richTextDeltaOps } from "../../../../src/composer/client/lib/richTextLoad";
import { editorState } from "../editorStates";

beforeAll(async () => {
  const host = createHost({ reactive: solidReactive });
  setHost(host);
  await host.register(
    {
      id: "users",
      setup: (ctx) =>
        ctx.provide(
          "users",
          partialService<Services["users"]>({
            userById: (id) => ({ avatarColor: "#000", id: parseUserId(id), name: `user-${id}` }),
          }),
        ),
    },
    {
      id: "titles",
      setup: (ctx) =>
        ctx.provide("titles", partialService<Services["titles"]>({ title: (id) => `chan-${id}` })),
    },
    {
      id: "usergroups",
      setup: (ctx) =>
        ctx.provide(
          "usergroups",
          partialService<Services["usergroups"]>({
            usergroupById: (id) => ({ handle: `group-${id}`, id, name: `@group-${id}` }),
          }),
        ),
    },
  );
});

const restore = (blocks: Block[]) => buildRichTextBlocks(richTextDeltaOps(blocks));

describe("a saved draft restored into the editor", () => {
  test("saves the same blocks again, so autosave never rewrites what it loaded", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const saved = buildRichTextBlocks(editorState(seededRandom(seed)));
      expect(restore(saved), `seed ${seed}: ${JSON.stringify(saved)}`).toEqual(saved);
    }
  });

  test("keeps all the visible text of a line", () => {
    const visible = (blocks: Block[]) => JSON.stringify(blocks).match(/"text":"[^"]*"/g) ?? [];
    for (let seed = 1; seed <= 400; seed++) {
      const saved = buildRichTextBlocks(editorState(seededRandom(seed)));
      expect(visible(restore(saved)), `seed ${seed}`).toEqual(visible(saved));
    }
  });

  test("an editor holding only blank lines saves one empty section", () => {
    for (const lines of [1, 2, 5]) {
      const ops: DeltaOp[] = Array.from({ length: lines }, () => ({ insert: "\n" }));
      const saved = buildRichTextBlocks(ops);
      expect(restore(saved)).toEqual(saved);
    }
  });
});
