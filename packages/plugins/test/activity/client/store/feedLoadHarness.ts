import { systemEnv } from "@slock/core";
import { inRoot } from "@slock/core/testing";
import { ch, stamp, uid } from "@slock/slack/testing";
import type { FeedEntry, Message, User } from "@slock/types";
import { createSignal, flush, until } from "solid-js";
import { createActivityFeedLoad } from "../../../../src/activity/client/store/activityFeedLoad";
import { createActivityItems } from "../../../../src/activity/client/store/activityItems";

export const me: User = { avatarColor: "", id: uid("U1"), name: "me" };
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

export type Page = { entries: FeedEntry[]; nextCursor?: string };

const disposers: (() => void)[] = [];

export function disposeHarnesses(): void {
  for (const dispose of disposers.splice(0)) dispose();
}

export function harness(pages: Record<string, Page>, options: { ready?: boolean } = {}) {
  const fetches: { cursor?: string; types?: string; unreadOnly?: boolean }[] = [];
  const reactionFlashes: string[] = [];
  const [ready, setReady] = createSignal(options.ready ?? true);
  const failures: string[] = [];
  let delayMs = 0;
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
  disposers.push(root.dispose, itemsRoot.dispose);
  const load = root.value;
  return {
    failOnce: (types: string | undefined, cursor: string) =>
      failures.push(`${types ?? ""}:${cursor}`),
    fetches,
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
