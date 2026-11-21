import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { applyPrefChange } from "@slock/plugins/slack/client/api";
import { createPrefsStore } from "./store";

const setup: Setup = (ctx) => {
  const bootstrap = service("bootstrap");
  const store = createPrefsStore({
    userPrefs: () => bootstrap.userPrefs().data,
  });
  ctx.provide("prefs", store);
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "dnd_updated") store.applyDndSnoozeEvent(event.snoozed_until);
    },
    types: ["dnd_updated"],
  });
  ctx.add(
    "realtime.handler",
    gatewayHandler(["pref_change"], async (event) => {
      if (!event.name || event.value === undefined) return;
      const next = await applyPrefChange(event.name, event.value);
      if (!next) return;
      bootstrap.mutateUserPrefs(() => next);
      store.syncRemotePrefs(next);
    }),
  );
};

export default setup;
