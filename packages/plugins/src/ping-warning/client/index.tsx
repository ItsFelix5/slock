import type { Setup } from "@slock/core";
import ThreadPingNotice from "./ThreadPingNotice";

const setup: Setup = (ctx) => {
  ctx.add("composer.notice", ThreadPingNotice);
};

export default setup;
