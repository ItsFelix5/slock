import type { Setup } from "@slock/core";
import { PaneRow } from "@slock/ui";

const setup: Setup = (ctx) => {
  ctx.add("shell.arrangement", { view: PaneRow }, { order: 100 });
};

export default setup;
