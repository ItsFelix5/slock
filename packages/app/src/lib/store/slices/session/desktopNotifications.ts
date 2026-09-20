import { createSignal } from "solid-js";
import type { UserPrefs } from "../../../api";
import { createLocalPref } from "../../../localPref";

type DesktopNotificationEvent = {
  avatarImage?: string;
  channel?: string;
  content?: string;
  event_ts?: string;
  launchUri?: string;
  msg?: string;
  subtitle?: string;
  title?: string;
};

function parseSlackDeepLink(uri: string | undefined): { channel?: string; ts?: string } {
  if (!uri?.includes("?")) return {};
  const params = new URLSearchParams(uri.slice(uri.indexOf("?") + 1));
  return { channel: params.get("id") ?? undefined, ts: params.get("message") ?? undefined };
}

export function createDesktopNotificationsSlice(deps: { userPrefs: () => UserPrefs | undefined }) {
  const supported = typeof window !== "undefined" && "Notification" in window;
  const [permission, setPermission] = createSignal<NotificationPermission>(
    supported ? Notification.permission : "denied",
  );
  const [override, persistOverride] = createLocalPref<boolean | null>(
    "desktop-notifications",
    null,
  );
  const enabled = () =>
    supported && (override() ?? deps.userPrefs()?.globalNotifications.desktopPushEnabled ?? false);

  function setNotificationsEnabled(next: boolean): void {
    persistOverride(next);
  }

  async function requestPermission() {
    if (!supported) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") setNotificationsEnabled(true);
  }

  function showGatewayNotification(
    payload: DesktopNotificationEvent,
    notifyDeps: {
      isChannelMuted: (id: string) => boolean;
      isDndActive: () => boolean;
      activeView: () => { kind: string; id: string } | null;
      openChannelPeek: (channelId: string, ts: string) => void;
    },
  ) {
    if (!supported || permission() !== "granted" || !enabled() || notifyDeps.isDndActive()) return;
    if (document.hasFocus() && document.visibilityState === "visible") return;
    const link = parseSlackDeepLink(payload.launchUri);
    const channelId = payload.channel ?? link.channel;
    if (!channelId || notifyDeps.isChannelMuted(channelId)) return;
    if (notifyDeps.activeView()?.id === channelId) return;

    const body = (payload.msg ?? payload.content ?? "").slice(0, 200);
    const title = payload.title || payload.subtitle || "New message";
    const notification = new Notification(title, {
      body,
      icon: payload.avatarImage,
      tag: payload.event_ts ?? channelId,
    });
    const ts = link.ts ?? payload.event_ts;
    notification.onclick = () => {
      window.focus();
      if (ts) notifyDeps.openChannelPeek(channelId, ts);
      notification.close();
    };
  }

  return {
    enabled,
    permission,
    requestPermission,
    setNotificationsEnabled,
    showGatewayNotification,
    supported,
  };
}
