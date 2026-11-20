import type { Setup } from "@slock/core";
import { service } from "@slock/core/solid";
import { isChannelId, isTs } from "@slock/slack";
import { Icon, useShortcut } from "@slock/ui";
import { lazy } from "solid-js";
import { liveOnly } from "../../messages/client/api/deletedMessages";
import {
  fetchMessagesByIds,
  fetchSaved,
  saveWithReminder,
  toggleSaved,
  updateSaved,
} from "../../slack/client/api";
import { createLaterSlice } from "./store";
import SaveButton from "./views/SaveButton";
import SavedBadge from "./views/SavedBadge";

const feedback = service("feedback");
const messageFocus = service("messages.focus");
const active = () => messageFocus.active();
const LaterView = lazy(() => import("./views/LaterView"));

const setup: Setup = (ctx) => {
  ctx.add(
    "sidebar.nav",
    {
      button: () => <Icon name="bookmark" size={16} />,
      feed: true,
      id: "later",
      label: "Saved items",
      view: LaterView,
    },
    { order: 20 },
  );
  const store = createLaterSlice(
    { fetchMessagesByIds, fetchSaved, saveWithReminder, toggleSaved, updateSaved },
    (...args) => feedback.flash(...args),
  );
  ctx.provide("later", store);
  ctx.add("realtime.handler", {
    run: (event) => {
      if (event.type === "saved_clear") store.applySavedEvent("clear");
      else if (event.type === "saved_added" || event.type === "saved_deleted") {
        const { channel, ts } = event.item;
        if (channel && ts && isChannelId(channel) && isTs(ts))
          store.applySavedEvent(event.type === "saved_added" ? "add" : "remove", channel, ts);
      }
    },
    types: ["saved_added", "saved_deleted", "saved_clear"],
  });
  ctx.add("realtime.handler", {
    run: () => {
      if (store.laterLoaded()) void store.ensureLaterLoaded();
    },
    types: ["saved_updated", "saved_due"],
  });
  useShortcut({
    combo: { key: "s" },
    enabled: () => active()?.focusedLiveTs() != null,
    group: "Message actions",
    handler: () => {
      const focus = active();
      const ts = focus?.focusedTs();
      const channelId = focus?.channelId();
      if (ts && channelId && isChannelId(channelId) && isTs(ts))
        void store.toggleSaveForLater(channelId, ts);
    },
    id: "messages.saveForLater",
    label: "Save / unsave for later",
    scope: "messages",
  });
  ctx.add("messages.badge", SavedBadge, { order: 10 });
  ctx.add("messages.bar", liveOnly(SaveButton), { order: 40 });
};

export default setup;
