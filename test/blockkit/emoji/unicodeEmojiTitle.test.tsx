import { afterEach, describe, expect, test } from "bun:test";
import EmojiText from "../../../packages/blockkit/src/emoji/EmojiText";
import {
  createEmojiSource,
  EmojiSourceContext,
} from "../../../packages/blockkit/src/emoji/emojiSource";
import { attrs, mount, unmountAll } from "../../support/dom";

afterEach(unmountAll);

describe("unicode emoji", () => {
  test("show the :name: tooltip like image emoji do", () => {
    const source = createEmojiSource(() =>
      Promise.resolve({ aliases: new Map<string, string>(), urls: new Map<string, string>() }),
    );
    const host = mount(() => (
      <EmojiSourceContext value={source}>
        <EmojiText text=":smile:" />
      </EmojiSourceContext>
    ));
    expect(attrs(host, "span.emoji", "title")).toEqual([":smile:"]);
  });
});
