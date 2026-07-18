import type { ActivityItem, Message } from "@slock/slack-api";
import { fetchPermalinkMessage } from "@slock/slack-api";
import type { MessageLocation } from "../types";

export function createReactionEvents(deps: {
  currentUser: () => { id: string } | undefined;
  pushActivity: (item: ActivityItem) => void;
  findAllMessageLocations: (
    channelId: string,
    ts: string,
  ) => { location: MessageLocation; list: Message[] }[];
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
}) {
  function pushReactionActivity(
    channel: string,
    ts: string,
    name: string,
    userId: string,
    msg: Message,
  ) {
    deps.pushActivity({
      channelId: channel,
      id: `rx-${channel}-${ts}-${name}-${userId}-${Date.now()}`,
      kind: "reaction",
      reactionName: name,
      text: msg.text,
      threadTs: msg.threadTs ?? ((msg.replyCount ?? 0) > 0 ? msg.ts : undefined),
      time: Date.now(),
      ts,
      userId,
    });
  }

  function applyReactionEvent(
    channel: string,
    ts: string,
    name: string,
    userId: string,
    added: boolean,
  ) {
    const locations = deps.findAllMessageLocations(channel, ts);
    const msg = locations[0]?.list.find((m) => m.ts === ts);
    if (msg) {
      const reactions = msg.reactions ?? [];
      const existing = reactions.find((r) => r.name === name);
      let next: typeof reactions;
      if (added) {
        next = existing
          ? reactions.map((r) =>
              r.name === name ? { ...r, count: r.count + 1, users: [...r.users, userId] } : r,
            )
          : [...reactions, { count: 1, name, users: [userId] }];
      } else if (existing) {
        next = reactions
          .map((r) =>
            r.name === name
              ? { ...r, count: r.count - 1, users: r.users.filter((u) => u !== userId) }
              : r,
          )
          .filter((r) => r.count > 0);
      } else {
        next = reactions;
      }
      deps.patchMessage(channel, ts, { reactions: next });
    }
    const me = deps.currentUser();
    if (!(added && me && userId !== me.id)) return;
    if (msg) {
      if (msg.userId === me.id) pushReactionActivity(channel, ts, name, userId, msg);
      return;
    }
    // Message isn't loaded locally (channel not currently open) — only
    // reactions on your own messages are activity-worthy, so fetch it just to
    // check ownership rather than dropping the event entirely.
    fetchPermalinkMessage(channel, ts, ts)
      .then((fetched) => {
        if (fetched && fetched.userId === me.id)
          pushReactionActivity(channel, ts, name, userId, fetched);
      })
      .catch(() => {});
  }

  return { applyReactionEvent };
}
