import type { Setup } from "@slock/core";
import { dateSuggest } from "./lib/dateSuggest";
import { editDateOnClick } from "./lib/editDateOnClick";
import InsertDateItem from "./views/InsertDateItem";

const setup: Setup = (ctx) => {
  ctx.add("composer.attach", InsertDateItem, { order: 10 });
  ctx.add("composer.editor", editDateOnClick);
  ctx.add("composer.suggest", dateSuggest);
};

export default setup;
