import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { lazy } from "solid-js";
import { createDesktopNotificationsStore } from "./store";

const view = lazy(() => import("./views/NotificationsTab"));

const setup: Setup = (ctx) => {
  const prefs = service("prefs");
  const channels = service("channels");
  const shellView = service("conversations");
  const store = createDesktopNotificationsStore({
    activeView: shellView.activeView,
    isChannelMuted: prefs.isChannelMuted,
    isDndActive: prefs.isDndActive,
    openChannelPeek: service("message-links").openChannelPeek,
    resolveChannel: channels.resolveChannel,
    userPrefs: () => service("bootstrap").userPrefs.data,
  });
  ctx.provide("notifications", store);
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "desktop_notification") void store.show(event);
    },
    types: ["desktop_notification"],
  });
  ctx.add("settings.tab", { id: "notifications", label: "Notifications", view }, { order: 10 });
};

export default setup;
