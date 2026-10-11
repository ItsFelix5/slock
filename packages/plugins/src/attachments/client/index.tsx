import type { Setup } from "@slock/core";
import AttachFileItem from "./views/AttachFileItem";

const setup: Setup = (ctx) => {
  ctx.add("composer.attach", AttachFileItem, { order: 0 });
};

export default setup;
