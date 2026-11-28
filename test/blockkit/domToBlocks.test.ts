import { expect, test } from "bun:test";
import { fragmentToBlocks } from "../../packages/blockkit/src/domToBlocks";

test("a copied tag keeps its color and style", () => {
  const root = document.createElement("div");
  root.innerHTML = 'a <span class="bk-tag bk-tag-orange bk-rt-bold">Blocked</span>';
  expect(JSON.stringify(fragmentToBlocks(root))).toContain(
    '{"color":"orange","style":{"bold":true},"text":"Blocked","type":"tag"}',
  );
});
