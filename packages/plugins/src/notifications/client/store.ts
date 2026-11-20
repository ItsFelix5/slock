import { isChannelId, isTs } from "@slock/slack";
import type { Channel, ChannelId, DesktopNotificationEvent, Ts, UserPrefs } from "@slock/types";
import { createSignal } from "solid-js";
import { createLocalPref } from "../../slack/client/api/localPref";
import { classifyNotification, type NotificationKind } from "./classify";

type Deps = {
  activeView: () => { kind: string; id: string } | null;
  isChannelMuted: (id: ChannelId) => boolean;
  isChannelNotifyAll: (id: ChannelId) => boolean;
  isDndActive: () => boolean;
  matchingHighlightWord: (text: string) => string | undefined;
  openChannelPeek: (channelId: ChannelId, ts: Ts) => void;
  resolveChannel: (id: ChannelId) => Promise<Pick<Channel, "canvasFileId" | "name"> | undefined>;
  userPrefs: () => UserPrefs | undefined;
};

function parseSlackDeepLink(uri: string | undefined): URLSearchParams {
  return new URLSearchParams(uri?.includes("?") ? uri.slice(uri.indexOf("?") + 1) : "");
}

export function createDesktopNotificationsStore(deps: Deps) {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = createSignal<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  const [override, setNotificationsEnabled] = createLocalPref<boolean | null>(
    "desktop-notifications",
    null,
  );
  const [disabledKinds, setDisabledKinds] = createLocalPref<NotificationKind[]>(
    "notification-disabled-kinds",
    [],
  );
  const isKindEnabled = (kind: NotificationKind) => !disabledKinds().includes(kind);
  const setKindEnabled = (kind: NotificationKind, on: boolean) =>
    setDisabledKinds([...disabledKinds().filter((k) => k !== kind), ...(on ? [] : [kind])]);
  const enabled = () =>
    supported && (override() ?? deps.userPrefs()?.globalNotifications.desktopPushEnabled ?? false);

  async function requestPermission() {
    if (!supported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") setNotificationsEnabled(true);
  }

  async function show(payload: DesktopNotificationEvent) {
    if (!supported || permission() !== "granted" || !enabled() || deps.isDndActive()) return;
    if (document.hasFocus() && document.visibilityState === "visible") return;
    const link = parseSlackDeepLink(payload.launchUri);
    const channelId = payload.channel ?? link.get("id");
    if (!(channelId && isChannelId(channelId)) || deps.isChannelMuted(channelId)) return;
    if (deps.activeView()?.id === channelId) return;

    const text = payload.msg ?? payload.content ?? "";
    const kind = classifyNotification(payload, link, {
      channelId,
      isNotifyAll: deps.isChannelNotifyAll(channelId),
      matchesPingword: !!deps.matchingHighlightWord(text),
    });
    if (!isKindEnabled(kind)) return;

    const body = text.slice(0, 200);
    const channel = await deps.resolveChannel(channelId);
    const title = channel?.canvasFileId
      ? `New comment on ${channel.name}`
      : payload.title || payload.subtitle || "New message";
    const notification = new Notification(title, {
      body,
      icon: payload.avatarImage,
      tag: payload.event_ts ?? channelId,
    });
    const ts = link.get("message") ?? payload.event_ts;
    notification.onclick = () => {
      window.focus();
      if (ts && isTs(ts)) deps.openChannelPeek(channelId, ts);
      notification.close();
    };
  }

  return {
    enabled,
    isKindEnabled,
    permission,
    requestPermission,
    setKindEnabled,
    setNotificationsEnabled,
    show,
    supported,
  };
}
