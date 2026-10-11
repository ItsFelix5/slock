import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { createPrefsStore } from "./store";

const setup: Setup = (ctx) => {
  const store = createPrefsStore({
    userPrefs: () => service("bootstrap").userPrefs.data,
  });
  ctx.provide("prefs", store);
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "dnd_updated") store.applyDndSnoozeEvent(event.snoozed_until);
    },
    types: ["dnd_updated"],
  });
};

export default setup;
