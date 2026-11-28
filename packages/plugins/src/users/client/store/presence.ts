import { defineQuery } from "@slock/plugins/query/client/api";
import type { UserId } from "@slock/types";
import { createStore } from "solid-js";
import type { UsersApi } from "./usersApi";

export type Presence = "active" | "away";

const UNKNOWN_TTL_MS = 30_000;

export function createPresence(fetchPresence: UsersApi["fetchUserPresence"]) {
  const [known, setKnown] = createStore<Record<UserId, Presence>>({});

  const show = (id: UserId, presence: Presence) =>
    setKnown((draft) => {
      draft[id] = presence;
    });

  const lookups = defineQuery<UserId, Presence | null>({
    gcMs: Number.POSITIVE_INFINITY,
    load: async (id, context) => {
      const presence = await fetchPresence(id);
      if (presence && !context.signal.aborted) show(id, presence);
      return presence;
    },
    maxAgeMs: (presence) => (presence === null ? UNKNOWN_TTL_MS : Number.POSITIVE_INFINITY),
    name: "presence",
    revalidates: false,
  });

  return {
    forget: (id: UserId) =>
      setKnown((draft) => {
        delete draft[id];
      }),
    known: (id: UserId): Presence | undefined => known[id],
    load: (id: UserId): void => void lookups.ensure(id).catch(() => {}),
    record: (id: UserId, presence: Presence) => {
      lookups.set(id, presence);
      show(id, presence);
    },
    watch: (id: UserId): Presence | undefined => {
      lookups.peek(id);
      return known[id];
    },
  };
}
