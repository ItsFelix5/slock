import { invalidateCustomEmoji } from "@slock/blockkit";
import type { Setup } from "@slock/core";
import { emojiAutoconvert } from "./api/emojiAutoconvert";
import { createEmojiIndex } from "./api/emojiSearch";

const setup: Setup = (ctx) => {
  ctx.provide("emoji", createEmojiIndex());
  ctx.add("realtime.handler", { run: invalidateCustomEmoji, types: ["emoji_changed"] });
  ctx.add("composer.editor", emojiAutoconvert);
  ctx.onCleanup(invalidateCustomEmoji);
};

export default setup;
