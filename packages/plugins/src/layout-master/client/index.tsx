import type { Setup } from "@slock/core";
import MasterLayout from "./views/MasterLayout";

const setup: Setup = (ctx) => {
  ctx.add("shell.arrangement", { view: MasterLayout }, { order: 0 });
};

export default setup;
