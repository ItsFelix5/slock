import type { Setup } from "@slock/core";

const setup: Setup = (ctx) => {
  ctx.add("http.csp", {
    "connect-src": ["https://g.tenor.com", "https://media.tenor.com"],
    "img-src": ["https://*.tenor.com"],
  });
};

export default setup;
