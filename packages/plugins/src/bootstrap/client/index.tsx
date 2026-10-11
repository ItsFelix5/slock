import { type Setup, Unavailable } from "@slock/core";
import { service } from "@slock/core/solid";
import { isConfigured } from "@slock/slack";
import { createBootstrapStore } from "./store";
import BootstrapError from "./views/BootstrapError";

const setup: Setup = (ctx) => {
  if (!isConfigured()) throw new Unavailable("needs an account");
  const store = createBootstrapStore({
    client: service("query").client,
    retryHooks: ctx.use("bootstrap.retry"),
  });
  ctx.provide("bootstrap", store);
  ctx.add("shell.ready", () => !!store.bootstrap.data);
  ctx.add("shell.blocker", { active: () => !!store.bootstrap.error, view: BootstrapError });
};

export default setup;
