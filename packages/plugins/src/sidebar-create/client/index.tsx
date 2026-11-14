import type { Setup } from "@slock/core";
import AddRow from "./views/AddRow";

const setup: Setup = (ctx) => {
  ctx.add("home.section", AddRow, { order: 100 });
};

export default setup;
