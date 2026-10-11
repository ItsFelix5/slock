import type { Setup } from "@slock/core";
import LastSeen from "./LastSeen";

const setup: Setup = (ctx) => {
  ctx.add("profile.meta", LastSeen);
};

export default setup;
