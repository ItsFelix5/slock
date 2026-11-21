import { stamp } from "@slock/slack/testing";
import type { ChannelId, GatewayEvent, RawMessage, RawReaction, Ts, UserId } from "@slock/types";

export function createFakeReactions() {
  const reactors = new Map<string, Set<UserId>>();
  const keyOf = (id: ChannelId, ts: Ts, name: string) => `${id}:${ts}:${name}`;

  const users = (id: ChannelId, ts: Ts, name: string) => [
    ...(reactors.get(keyOf(id, ts, name)) ?? []),
  ];

  function names(id: ChannelId, ts: Ts) {
    const prefix = keyOf(id, ts, "");
    return [...reactors.entries()]
      .filter(([key, who]) => key.startsWith(prefix) && who.size > 0)
      .map(([key]) => key.slice(prefix.length));
  }

  return {
    attach(id: ChannelId, m: RawMessage): RawMessage {
      const ts = stamp(m.ts);
      const reactions: RawReaction[] = names(id, ts).map((name) => ({
        count: users(id, ts, name).length,
        name,
        users: users(id, ts, name),
      }));
      return reactions.length ? { ...m, reactions } : m;
    },
    event: (id: ChannelId, ts: Ts, name: string, user: UserId, added: boolean): GatewayEvent => ({
      item: { channel: id, ts },
      reaction: name,
      type: added ? "reaction_added" : "reaction_removed",
      user,
    }),
    set(id: ChannelId, ts: Ts, name: string, user: UserId, on: boolean) {
      const key = keyOf(id, ts, name);
      const who = reactors.get(key) ?? new Set<UserId>();
      reactors.set(key, who);
      if (who.has(user) === on) return false;
      if (on) who.add(user);
      else who.delete(user);
      return true;
    },
    users,
  };
}
