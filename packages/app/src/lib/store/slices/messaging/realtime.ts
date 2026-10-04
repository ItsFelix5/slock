import { invalidateCustomEmoji } from "@slock/blockkit";
import type { GatewayEvent } from "@slock/types";
import { parseBadgeCounts, SLACK_USER_ID } from "@slock/types";
import { createEffect } from "solid-js";
import { invalidateSlashCommandSuggestions } from "../../../../components/composer/lib/commands/slashCommandSuggestions";
import { fetchUserPresence } from "../../../api";
import { filesLinksChannelId, retryFilesLinks } from "../../../filesLinksPanel";
import { isDmId } from "../entities/dms";
import { createRealtimeConnection } from "./connection/realtimeConnection";
import { createIncomingMessageHandler } from "./incomingMessages";
import { createMembershipEvents } from "./membershipEvents";
import type { RealtimeDeps } from "./realtimeDeps";

function wsUrl() {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${location.host}/ws`;
}
export function createRealtimeSlice(deps: RealtimeDeps) {
  const membershipEvents = createMembershipEvents(deps);
  const handleIncomingMessage = createIncomingMessageHandler(deps);
  function send(payload: unknown) {
    return connection.send(payload);
  }
  function presenceSubIds(): string[] {
    const selfId = deps.currentUser()?.id;
    const ids = new Set<string>();
    for (const dm of deps.allDirectMessages()) {
      if (dm.userId) ids.add(dm.userId);
      for (const id of dm.memberIds ?? []) ids.add(id);
    }
    if (selfId) ids.add(selfId);
    ids.delete(SLACK_USER_ID);
    return [...ids];
  }
  const presenceHydrated = new Set<string>();
  function hydratePresence(ids: string[]) {
    for (const id of ids) {
      if (presenceHydrated.has(id)) continue;
      presenceHydrated.add(id);
      fetchUserPresence(id)
        .then((presence) => presence && deps.setPresenceOverrides(id, presence))
        .catch(() => presenceHydrated.delete(id));
    }
  }
  function handleRawMessage(raw: string) {
    let payload: GatewayEvent;
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    switch (payload.type) {
      case "_status":
        connection.setGatewayConnected(!!payload.connected);
        break;
      case "message":
        handleIncomingMessage(payload);
        break;
      case "reaction_added":
      case "reaction_removed":
        if (!(payload.item.channel && payload.item.ts && payload.reaction && payload.user)) break;
        if (payload.user !== deps.currentUser()?.id) {
          deps.applyReactionEvent(
            payload.item.channel,
            payload.item.ts,
            payload.reaction,
            payload.user,
            payload.type === "reaction_added",
          );
        }
        break;
      case "presence_change": {
        const presence = payload.presence === "away" ? "away" : "active";
        const ids = payload.users ?? (payload.user ? [payload.user] : []);
        for (const id of ids) deps.setPresenceOverrides(id, presence);
        break;
      }
      case "user_typing": {
        if (payload.channel && payload.user && payload.user !== deps.currentUser()?.id) {
          deps.recordTyping(payload.channel, payload.thread_ts, payload.user);
        }
        break;
      }
      case "badge_counts_updated": {
        for (const [id, { unread, mentions }] of Object.entries(parseBadgeCounts(payload))) {
          deps.setUnreadChannelIds(id, unread);
          const isDm = isDmId(id, (dmId) => !!deps.dmById(dmId));
          if (isDm) deps.patchDm(id, { mentions });
          else deps.patchChannel(id, { mentions });
        }
        const activityCountsChanged = deps.setGatewayActivityBadgeCounts(payload.activity_v2);

        if (activityCountsChanged) deps.refreshActivityFeed();
        break;
      }
      case "channel_marked": {
        if (!(payload.channel && payload.ts) || deps.isStaleReadEcho(payload.channel, payload.ts))
          break;
        deps.setUnreadChannelIds(payload.channel, (payload.unread_count ?? 0) > 0);
        deps.patchChannel(payload.channel, { mentions: payload.mention_count ?? 0 });
        const readTs = Number(payload.ts) * 1000;
        if (Number.isFinite(readTs)) deps.setLastReadByChannel(payload.channel, readTs);
        break;
      }
      case "user_invalidated": {
        const ids = payload.users ?? (payload.user ? [payload.user] : []);
        for (const id of ids) deps.invalidateUser(id);
        break;
      }
      case "channel_joined":
      case "group_joined":
      case "channel_left":
      case "group_left":
      case "member_left_channel":
      case "im_created":
      case "im_close":
      case "im_open":
      case "mpim_close":
      case "mpim_open":
      case "mpim_joined":
      case "channel_rename":
      case "group_rename":
      case "channel_archive":
      case "channel_unarchive":
      case "group_archive":
      case "group_unarchive":
      case "channel_deleted":
        membershipEvents.handleMembershipEvent(payload);
        break;
      case "view_opened":
        if (payload.view_type === "modal" && payload.view) deps.openModalView(payload.view);
        break;
      case "view_updated":
        if (payload.view_type === "modal" && payload.view) deps.updateModalView(payload.view);
        break;
      case "pin_added":
      case "pin_removed":
        if (payload.channel_id && payload.ts)
          deps.applyPinEvent(payload.channel_id, payload.ts, payload.type === "pin_added");
        break;
      case "star_added":
      case "star_removed":
        if (payload.item.type === "channel" && payload.item.channel)
          deps.setChannelStarred(payload.item.channel, payload.type === "star_added");
        break;
      case "saved_added":
      case "saved_deleted":
        deps.applySavedEvent(
          payload.type === "saved_added" ? "add" : "remove",
          payload.item.channel,
          payload.item.ts,
        );
        break;
      case "saved_clear":
        deps.applySavedEvent("clear");
        break;
      case "subteam_created":
      case "subteam_updated":
      case "subteam_deleted":
        if (payload.subteam.id) deps.invalidateUsergroup(payload.subteam.id);
        break;
      case "subteam_members_changed":
        if (payload.subteam_id) deps.invalidateUsergroup(payload.subteam_id);
        break;
      case "user_change":
        deps.invalidateUser(payload.user.id);
        break;
      case "dnd_updated":
        deps.applyDndSnoozeEvent(payload.snoozed_until);
        break;
      case "canvas_created":
        if (payload.channel_id) deps.handleCanvasCreated(payload.channel_id);
        break;
      case "bot_added":
      case "bot_changed":
        if (payload.bot.id) deps.invalidateUser(payload.bot.id);
        break;
      case "commands_changed":
        invalidateSlashCommandSuggestions();
        break;
      case "emoji_changed":
        invalidateCustomEmoji();
        break;
      case "thread_marked":
        if (payload.thread_ts && typeof payload.unread_count === "number")
          deps.applyThreadMarked(payload.thread_ts, payload.unread_count);
        break;
      case "thread_subscribed":
      case "thread_unsubscribed":
        if (payload.channel && payload.thread_ts)
          deps.patchMessage(payload.channel, payload.thread_ts, {
            isSubscribed: payload.type === "thread_subscribed",
          });
        break;
      case "manual_presence_change": {
        const selfId = deps.currentUser()?.id;
        if (selfId)
          deps.setPresenceOverrides(selfId, payload.presence === "away" ? "away" : "active");
        break;
      }
      case "desktop_notification":
        deps.showGatewayNotification(payload);
        break;
      default:
        if (filesLinksChannelId()) retryFilesLinks();
        break;
    }
  }
  const connection = createRealtimeConnection({
    onMessage: handleRawMessage,
    onOpen: () => {
      for (const channel of deps.loadedChannels) send({ channel, type: "watch_channel" });
      for (const thread of deps.visibleThreads())
        send({
          channel: thread.channelId,
          ts: thread.ts,
          type: "watch_thread",
        });
      send({ ids: presenceSubIds(), type: "watch_presence" });
    },
    onReconnect: () => {
      const visibleIds = new Set(deps.visibleViews().map((view) => view.id));
      for (const channel of deps.loadedChannels) {
        if (visibleIds.has(channel)) deps.loadRecentHistory(channel);
        else deps.loadedChannels.delete(channel);
      }
      for (const thread of deps.visibleThreads()) deps.refreshThreadReplies(thread.ts);
    },
    url: wsUrl,
  });
  createEffect(() => {
    for (const view of deps.visibleViews()) send({ channel: view.id, type: "watch_channel" });
  });
  createEffect(() => {
    for (const thread of deps.visibleThreads())
      send({ channel: thread.channelId, ts: thread.ts, type: "watch_thread" });
  });
  createEffect(() => {
    const ids = presenceSubIds();
    send({ ids, type: "watch_presence" });
    hydratePresence(ids);
  });
  return {
    connectionState: connection.connectionState,
    isSelfOnline: connection.isSelfOnline,
    retryConnection: connection.retry,
    gatewayConnected: connection.gatewayConnected,
    send,
  };
}
