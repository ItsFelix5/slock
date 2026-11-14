import type { Setup } from "@slock/core";
import ScrollingLayout from "./views/ScrollingLayout";

const setup: Setup = (ctx) => {
  ctx.add("shell.arrangement", { view: ScrollingLayout }, { order: 0 });
};

export default setup;
