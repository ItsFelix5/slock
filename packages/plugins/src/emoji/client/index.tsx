import { EmojiSourceContext } from "@slock/blockkit";
import type { Setup } from "@slock/core";
import { createCustomEmojiSource } from "./api/customEmojiSource";
import { emojiAutoconvert } from "./api/emojiAutoconvert";
import { createEmojiIndex } from "./api/emojiSearch";

const setup: Setup = (ctx) => {
  const source = createCustomEmojiSource();
  ctx.provide("emoji", createEmojiIndex(source));
  void source.load();
  ctx.add("realtime.handler", { run: source.invalidate, types: ["emoji_changed"] });
  ctx.add("composer.editor", emojiAutoconvert);
  ctx.add("shell.provider", (props) => (
    <EmojiSourceContext value={source}>{props.children}</EmojiSourceContext>
  ));
  ctx.onCleanup(source.invalidate);
};

export default setup;
