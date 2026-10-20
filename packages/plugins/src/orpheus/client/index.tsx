import type { Setup } from "@slock/core";
import OrpheusIndicator from "./OrpheusIndicator";

const setup: Setup = (ctx) => {
  ctx.add("composer.trailing", OrpheusIndicator);
};

export default setup;
