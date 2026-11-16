import type { Setup } from "@slock/core";
import { lazy } from "solid-js";

const RelaySection = lazy(() => import("./views/RelaySection"));

const setup: Setup = (ctx) => {
  ctx.add("account.section", RelaySection, { order: 10 });
};

export default setup;
