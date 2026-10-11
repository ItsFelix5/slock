import type { Channel, DesktopNotificationEvent, UserPrefs } from "@slock/types";
import { createSignal } from "solid-js";
import { createLocalPref } from "../../slack/client/api/localPref";

type Deps = {
  activeView: () => { kind: string; id: string } | null;
  isChannelMuted: (id: string) => boolean;
  isDndActive: () => boolean;
  openChannelPeek: (channelId: string, ts: string) => void;
  resolveChannel: (id: string) => Promise<Pick<Channel, "canvasFileId" | "name"> | undefined>;
  userPrefs: () => UserPrefs | undefined;
};

function parseSlackDeepLink(uri: string | undefined): { channel?: string; ts?: string } {
  if (!uri?.includes("?")) return {};
  const params = new URLSearchParams(uri.slice(uri.indexOf("?") + 1));
  return { channel: params.get("id") ?? undefined, ts: params.get("message") ?? undefined };
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
    const channelId = payload.channel ?? link.channel;
    if (!channelId || deps.isChannelMuted(channelId)) return;
    if (deps.activeView()?.id === channelId) return;

    const body = (payload.msg ?? payload.content ?? "").slice(0, 200);
    const channel = await deps.resolveChannel(channelId);
    const title = channel?.canvasFileId
      ? `New comment on ${channel.name}`
      : payload.title || payload.subtitle || "New message";
    const notification = new Notification(title, {
      body,
      icon: payload.avatarImage,
      tag: payload.event_ts ?? channelId,
    });
    const ts = link.ts ?? payload.event_ts;
    notification.onclick = () => {
      window.focus();
      if (ts) deps.openChannelPeek(channelId, ts);
      notification.close();
    };
  }

  return { enabled, permission, requestPermission, setNotificationsEnabled, show, supported };
}
