import type { Setup } from "@slock/core";

const setup: Setup = (ctx) => {
  ctx.add("http.csp", { "frame-src": ["https:"], "media-src": ["https:"] });
};

export default setup;
