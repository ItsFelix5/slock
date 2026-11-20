import { service } from "@slock/core/solid";
import type { TimerHandle } from "@slock/core/types";
import type { ChannelId, Ts, User, UserId } from "@slock/types";
import { createStore, onCleanup } from "solid-js";

const TYPING_TTL_MS = 4000;
const SWEEP_SLACK_MS = 50;

const env = service("env");

export function createTypingSlice(deps: { userById: (id: string) => User | undefined }) {
  const [typingByKey, setTypingByKey] = createStore<Record<string, Record<string, number>>>({});
  let sweepTimer: TimerHandle | undefined;

  function sweep() {
    sweepTimer = undefined;
    const now = env.now();
    let nextExpiry = Number.POSITIVE_INFINITY;
    setTypingByKey((all) => {
      for (const [key, entries] of Object.entries(all)) {
        for (const [userId, expiresAt] of Object.entries(entries)) {
          if (expiresAt <= now) delete entries[userId];
          else nextExpiry = Math.min(nextExpiry, expiresAt);
        }
        if (Object.keys(entries).length === 0) delete all[key];
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
    const expiresAt = env.now() + TYPING_TTL_MS;
    setTypingByKey((all) => {
      all[key] = { ...all[key], [userId]: expiresAt };
    });
    armSweep(expiresAt);
  }

  function clearTyping(channelId: ChannelId, threadTs: Ts | undefined, userId: UserId) {
    const key = typingKey(channelId, threadTs);
    setTypingByKey((all) => {
      const entries = all[key];
      if (!entries?.[userId]) return;
      delete entries[userId];
      if (Object.keys(entries).length === 0) delete all[key];
    });
  }

  function typingUsers(key: string): User[] {
    const entries = typingByKey[key];
    if (!entries) return [];
    return Object.keys(entries).flatMap((id) => {
      const user = deps.userById(id);
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
