import type { Setup } from "@slock/core";
import { createGifsStore } from "./store";
import FavoriteMessageItem from "./views/FavoriteMessageItem";
import FavoriteStar from "./views/FavoriteStar";
import InsertGifItem from "./views/InsertGifItem";

const setup: Setup = (ctx) => {
  ctx.provide("gifs", createGifsStore());
  ctx.add("composer.attach", InsertGifItem, { order: 20 });
  ctx.add("message-media.attachmentOverlay", FavoriteStar);
  ctx.add("messages.menu", FavoriteMessageItem, { order: 55 });
};

export default setup;
