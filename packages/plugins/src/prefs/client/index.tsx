import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { gatewayHandler } from "@slock/plugins/realtime/client/api";
import { patchInitialData } from "@slock/plugins/slack/client/api/initialData";
import { createPrefsStore } from "./store";

const SYNCED_PREFS = ["channel_sections", "emoji_use", "muted_channels", "notification_prefs"];

const setup: Setup = (ctx) => {
  const bootstrap = service("bootstrap");
  const store = createPrefsStore({
    overlayUserPrefs: (change) => bootstrap.overlayUserPrefs(change),
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
      if (!(event.name && SYNCED_PREFS.includes(event.name)) || event.value === undefined) return;
      patchInitialData({ [event.name]: event.value });
      await bootstrap.retryUserPrefs();
    }),
  );
};

export default setup;
