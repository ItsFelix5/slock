import { service } from "@slock/core/solid";
import type { TimerHandle } from "@slock/core/types";
import type { ChannelId, Ts, User, UserId } from "@slock/types";
import { createStore, onCleanup } from "solid-js";

const TYPING_TTL_MS = 4000;
const SWEEP_SLACK_MS = 50;

const env = service("env");

interface TypingEntry {
  expiresAt: number;
  userId: UserId;
}

export function createTypingSlice(deps: { userById: (id: UserId) => User | undefined }) {
  const [typingByKey, setTypingByKey] = createStore<Record<string, TypingEntry[]>>({});
  let sweepTimer: TimerHandle | undefined;

  function sweep() {
    sweepTimer = undefined;
    const now = env.now();
    let nextExpiry = Number.POSITIVE_INFINITY;
    setTypingByKey((all) => {
      for (const [key, entries] of Object.entries(all)) {
        const live = entries.filter((entry) => entry.expiresAt > now);
        for (const entry of live) nextExpiry = Math.min(nextExpiry, entry.expiresAt);
        if (live.length === 0) delete all[key];
        else all[key] = live;
      }
    });
    if (nextExpiry !== Number.POSITIVE_INFINITY) armSweep(nextExpiry);
  }

  function armSweep(expiresAt: number) {
    if (sweepTimer) return;
    sweepTimer = env.setTimeout(sweep, Math.max(expiresAt - env.now(), 0) + SWEEP_SLACK_MS);
  }
  onCleanup(() => env.clearTimeout(sweepTimer));

  const typingKey = (channelId: ChannelId, threadTs?: Ts) =>
    threadTs ? `${channelId}:${threadTs}` : channelId;

  function recordTyping(channelId: ChannelId, threadTs: Ts | undefined, userId: UserId) {
    const key = typingKey(channelId, threadTs);
    const entry = { expiresAt: env.now() + TYPING_TTL_MS, userId };
    setTypingByKey((all) => {
      const entries = all[key] ?? [];
      all[key] = entries.some((e) => e.userId === userId)
        ? entries.map((e) => (e.userId === userId ? entry : e))
        : [...entries, entry];
    });
    armSweep(entry.expiresAt);
  }

  function clearTyping(channelId: ChannelId, threadTs: Ts | undefined, userId: UserId) {
    const key = typingKey(channelId, threadTs);
    setTypingByKey((all) => {
      const rest = (all[key] ?? []).filter((entry) => entry.userId !== userId);
      if (rest.length === 0) delete all[key];
      else all[key] = rest;
    });
  }

  function typingUsers(key: string): User[] {
    return (typingByKey[key] ?? []).flatMap(({ userId }) => {
      const user = deps.userById(userId);
      return user ? [user] : [];
    });
  }

  return {
    clearTyping,
    recordTyping,
    typingUsersInChannel: (channelId: ChannelId) => typingUsers(channelId),
    typingUsersInThread: (channelId: ChannelId, ts: Ts) => typingUsers(typingKey(channelId, ts)),
  };
}
