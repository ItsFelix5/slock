import type { ActivityItem, Channel, User } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import { PING_KINDS } from "../messaging/activity";

const ENABLED_KEY = "slock:desktop-notifications-enabled";

// A pure client-side preference — unlike mute/DND/notify-all, Slack's own
// account has no concept of "should this browser tab pop OS notifications",
// so this one genuinely belongs in localStorage rather than being faked as
// account state.
function loadEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) !== "off";
}

export function createDesktopNotificationsSlice() {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = createSignal<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  const [enabled, setEnabled] = createSignal(supported && loadEnabled());

  function setNotificationsEnabled(next: boolean) {
    setEnabled(next);
    localStorage.setItem(ENABLED_KEY, next ? "on" : "off");
  }

  async function requestPermission() {
    if (!supported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") setNotificationsEnabled(true);
  }

  // Wires the effect that actually pops notifications — kept separate from
  // the constructor (like unread.ts's wireReadTracking) since it needs
  // several other slices that don't exist yet when this one is built.
  function wireNotifications(deps: {
    activityItems: ActivityItem[];
    userById: (id: string) => User | undefined;
    channelById: (id: string) => Channel | undefined;
    channelDisplayName: (channel: Channel | undefined, id: string) => string;
    isChannelMuted: (id: string) => boolean;
    isDndActive: () => boolean;
    activeView: () => { kind: string; id: string } | null;
    openChannelPeek: (channelId: string, ts: string) => void;
  }) {
    if (!supported) return;

    function showNotification(item: ActivityItem) {
      const user = deps.userById(item.userId);
      const title =
        item.kind === "dm"
          ? (user?.name ?? "New message")
          : `${user?.name ?? "Someone"} in #${deps.channelDisplayName(deps.channelById(item.channelId), item.channelId)}`;
      const notification = new Notification(title, {
        body: item.text.slice(0, 200),
        icon: user?.avatarUrl,
        tag: item.id,
      });
      notification.onclick = () => {
        window.focus();
        deps.openChannelPeek(item.channelId, item.threadTs ?? item.ts);
        notification.close();
      };
    }

    // Skip the boot-time batch (fetchMentions history, gateway-reconnect
    // replay) — only items that land after this effect is already live
    // should ever pop a notification.
    let lastSeenTs = Date.now();
    let firstRun = true;
    createEffect(() => {
      const items = deps.activityItems;
      if (firstRun) {
        firstRun = false;
        return;
      }
      if (permission() !== "granted" || !enabled() || deps.isDndActive()) return;
      // A focused, visible tab already shows the activity live — no need to
      // also pop an OS notification over it.
      if (document.hasFocus() && document.visibilityState === "visible") return;
      let newest = lastSeenTs;
      for (const item of items) {
        if (item.time <= lastSeenTs) continue;
        if (item.time > newest) newest = item.time;
        if (!PING_KINDS.has(item.kind)) continue;
        if (deps.isChannelMuted(item.channelId)) continue;
        showNotification(item);
      }
      lastSeenTs = newest;
    });
  }

  return {
    supported,
    permission,
    enabled,
    requestPermission,
    setNotificationsEnabled,
    wireNotifications,
  };
}
