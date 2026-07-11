import type { ActivityItem, Channel, User, UserPrefs } from "@slock/slack-api";
import { setDesktopNotificationsEnabled as setDesktopNotificationsEnabledApi } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import { PING_KINDS } from "../messaging/activity";

// Synced through the same users.prefs blob as mute/pingwords (custom key,
// since Slack's own account has no built-in concept of "pop OS
// notifications") rather than localStorage, so it follows you across devices.
export function createDesktopNotificationsSlice(deps: { userPrefs: () => UserPrefs | undefined }) {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = createSignal<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  const [enabled, setEnabled] = createSignal(false);

  let seeded = false;
  createEffect(() => {
    const prefs = deps.userPrefs();
    if (!prefs || seeded) return;
    seeded = true;
    setEnabled(supported && prefs.desktopNotificationsEnabled);
  });

  function setNotificationsEnabled(next: boolean) {
    setEnabled(next);
    setDesktopNotificationsEnabledApi(next).catch((err) => {
      console.error("Failed to set desktop notification preference", err);
    });
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
