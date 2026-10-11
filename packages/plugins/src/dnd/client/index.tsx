import type { Setup } from "@slock/core";
import DndButton from "./views/DndButton";

const setup: Setup = (ctx) => {
  ctx.add("sidebar.toolbar", DndButton, { order: 10 });
};

export default setup;
