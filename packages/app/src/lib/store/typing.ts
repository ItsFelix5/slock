import type { User } from "@slock/slack-api";
import { onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";

// Keyed by channel id, or `${channel}:${thread_ts}` for typing inside a thread's
// reply composer — Slack keeps those scoped separately so the main channel view
// doesn't show "typing" for someone who's only replying in a thread. Values are
// expiry timestamps: there's no explicit "stopped typing" event, only repeated
// user_typing pushes every ~3s while the composer stays non-empty, so an entry
// is swept once it goes a beat past that without a refresh.
const TYPING_TTL_MS = 4000;

export function createTypingSlice(deps: { userById: (id: string) => User | undefined }) {
  const [typingByKey, setTypingByKey] = createStore<Record<string, Record<string, number>>>({});

  const sweepTimer: ReturnType<typeof setInterval> = setInterval(() => {
    const now = Date.now();
    for (const key of Object.keys(typingByKey)) {
      const entries = typingByKey[key];
      for (const userId of Object.keys(entries)) {
        if (entries[userId] <= now) {
          setTypingByKey(
            key,
            produce((e) => {
              delete e[userId];
            }),
          );
        }
      }
    }
  }, 1000);
  onCleanup(() => clearInterval(sweepTimer));

  function recordTyping(channelId: string, threadTs: string | undefined, userId: string) {
    const key = threadTs ? `${channelId}:${threadTs}` : channelId;
    const expiresAt = Date.now() + TYPING_TTL_MS;
    setTypingByKey(
      produce((s) => {
        if (!s[key]) s[key] = {};
        s[key][userId] = expiresAt;
      }),
    );
  }

  function typingUsersInChannel(channelId: string): User[] {
    const entries = typingByKey[channelId];
    if (!entries) return [];
    return Object.keys(entries)
      .map(deps.userById)
      .filter((u): u is User => !!u);
  }

  function typingUsersInThread(channelId: string, ts: string): User[] {
    const entries = typingByKey[`${channelId}:${ts}`];
    if (!entries) return [];
    return Object.keys(entries)
      .map(deps.userById)
      .filter((u): u is User => !!u);
  }

  return { recordTyping, typingUsersInChannel, typingUsersInThread };
}
