import type { Setup } from "@slock/core";
import { resetDrafts } from "./draftStore";

const setup: Setup = (ctx) => {
  ctx.onCleanup(resetDrafts);
};

export default setup;
