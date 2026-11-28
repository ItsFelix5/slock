import { systemEnv } from "@slock/core";
import type { FeedEntry, Message, User } from "@slock/types";
import { createSignal, flush, until } from "solid-js";
import { createActivityFeedLoad } from "../../../../../packages/plugins/src/activity/client/store/activityFeedLoad";
import { createActivityItems } from "../../../../../packages/plugins/src/activity/client/store/activityItems";
import { inRoot } from "../../../../support/core";
import { ch, stamp, uid } from "../../../../support/slack";

const me: User = { avatarColor: "", id: uid("U1"), name: "me" };
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function entry(id: string, time: number, patch: Partial<FeedEntry> = {}): FeedEntry {
  return {
    channelId: ch("C1"),
    id,
    kind: "mention",
    text: id,
    time,
    ts: stamp(`${time}.0`),
    unread: true,
    userId: uid("U2"),
    ...patch,
  };
}

type Page = { entries: FeedEntry[]; nextCursor?: string };

export function harness(
  pages: Record<string, Page>,
  options: { held?: boolean; ready?: boolean } = {},
) {
  const fetches: { cursor?: string; types?: string; unreadOnly?: boolean }[] = [];
  const reactionFlashes: string[] = [];
  const [ready, setReady] = createSignal(options.ready ?? true);
  const failures: string[] = [];
  let delayMs = 0;
  const held = Promise.withResolvers<void>();
  const gate = options.held ? held.promise : Promise.resolve();
  const itemsRoot = inRoot(createActivityItems);
  const items = itemsRoot.value;
  const root = inRoot(() =>
    createActivityFeedLoad({
      backfillMissingReadCursors: async () => {},
      currentUser: () => me,
      env: systemEnv,
      fetchActivityFeedEntries: async (_limit, cursor, types, unreadOnly) => {
        fetches.push({ cursor, types, ...(unreadOnly ? { unreadOnly } : {}) });
        if (delayMs) await wait(delayMs);
        await gate;
        const key = `${types ?? ""}${unreadOnly ? "|unread" : ""}:${cursor ?? ""}`;
        if (failures.includes(key)) {
          failures.splice(failures.indexOf(key), 1);
          throw new Error("down");
        }
        return pages[key] ?? { entries: [] };
      },
      fetchHistoryAround: async () => ({ messages: [] }),
      fetchMessagesByIds: async () => new Map<string, Message>(),
      items,
      onReactionPushed: (name) => reactionFlashes.push(name),
      ready,
      resolveActivityEntry: (raw) => ({ ...raw, text: raw.text ?? "" }),
    }),
  );
  const load = root.value;
  return {
    [Symbol.dispose]: () => {
      root.dispose();
      itemsRoot.dispose();
    },
    failOnce: (types: string | undefined, cursor: string) =>
      failures.push(`${types ?? ""}:${cursor}`),
    fetches,
    release: held.resolve,
    ids: () => items.list.map((item) => item.id),
    items: items.list,
    load,
    loaded: () => until(load.activityFeed),
    more: async (types?: string, unreadOnly?: boolean) => {
      load.loadMoreActivity(types, unreadOnly);
      flush();
      await wait(delayMs + 5);
    },
    pages,
    reactionFlashes,
    setDelay: (ms: number) => {
      delayMs = ms;
    },
    setReady,
  };
}
