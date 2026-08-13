import type { ActivityItem, Channel, DirectMessage, User, UserPrefs } from "@slock/slack-api";
import { setDesktopNotificationsEnabled as setDesktopNotificationsEnabledApi } from "@slock/slack-api";
import { createEffect, createSignal } from "solid-js";
import { conversationDisplayName } from "../conversationDisplayName";
import { actionFeedback } from "../feedback";
import { PING_KINDS } from "../messaging/activity";

export function createDesktopNotificationsSlice(deps: { userPrefs: () => UserPrefs | undefined }) {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = createSignal<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  const [enabled, setEnabled] = createSignal(false);
  const [pending, setPending] = createSignal(false);

  let seeded = false;
  createEffect(() => {
    const prefs = deps.userPrefs();
    if (!prefs || seeded) return;
    seeded = true;
    setEnabled(supported && prefs.desktopNotificationsEnabled);
  });

  async function setNotificationsEnabled(next: boolean): Promise<void> {
    if (pending()) return;
    if (!deps.userPrefs()) {
      actionFeedback.flash(
        "desktop-notifications",
        "Preferences are unavailable. Try loading them again.",
        "error",
      );
      return;
    }
    const previous = enabled();
    setPending(true);
    setEnabled(next);
    try {
      await setDesktopNotificationsEnabledApi(next);
    } catch (err) {
      console.error("Failed to set desktop notification preference", err);
      actionFeedback.flash(
        "desktop-notifications",
        "Failed to update desktop notifications.",
        "error",
      );
      setEnabled(previous);
    } finally {
      setPending(false);
    }
  }

  async function requestPermission() {
    if (!supported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") setNotificationsEnabled(true);
  }

  function wireNotifications(deps: {
    activityItems: ActivityItem[];
    userById: (id: string) => User | undefined;
    channelById: (id: string) => Channel | undefined;
    dmById: (id: string) => DirectMessage | undefined;
    isChannelMuted: (id: string) => boolean;
    isDndActive: () => boolean;
    activeView: () => { kind: string; id: string } | null;
    openChannelPeek: (channelId: string, ts: string, highlightTs?: string) => void;
  }) {
    if (!supported) return;

    function showNotification(item: ActivityItem) {
      const user = deps.userById(item.userId);
      const title =
        item.kind === "dm"
          ? (user?.name ?? "New message")
          : `${user?.name ?? "Someone"} in ${conversationDisplayName(
              item.channelId,
              item.channelId.startsWith("D") ? undefined : deps.channelById(item.channelId),
              deps.dmById(item.channelId),
              deps.userById,
            )}`;
      const notification = new Notification(title, {
        body: item.text.slice(0, 200),
        icon: user?.avatarUrl,
        tag: item.id,
      });
      notification.onclick = () => {
        window.focus();
        deps.openChannelPeek(
          item.channelId,
          item.threadTs ?? item.ts,
          item.threadTs ? item.ts : undefined,
        );
        notification.close();
      };
    }

    let lastSeenTs = Date.now();
    let firstRun = true;
    createEffect(() => {
      const items = deps.activityItems;
      if (firstRun) {
        firstRun = false;
        return;
      }
      if (permission() !== "granted" || !enabled() || deps.isDndActive()) return;

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
    enabled,
    isPending: pending,
    permission,
    requestPermission,
    setNotificationsEnabled,
    supported,
    wireNotifications,
  };
}
