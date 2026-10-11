import { service } from "@slock/core/solid";
import { createMemo } from "solid-js";
import type { ActivityRow as ActivityRowData } from "./ActivityRow";

const activityStore = service("activity");

function sameItems(a: ActivityRowData["items"], b: ActivityRowData["items"]) {
  if (a.length !== b.length) return false;
  return a.every((item, i) => item === b[i]);
}

export function createActivityRows() {
  let rowsCache = new Map<string, ActivityRowData>();
  const rows = createMemo<ActivityRowData[]>(() => {
    const buckets = new Map<string, ActivityRowData["items"]>();
    const items = [...activityStore.activityItems].sort((a, b) => b.time - a.time);
    for (const item of items) {
      const threadTs = item.kind === "thread_reply" ? (item.threadTs ?? item.ts) : undefined;
      const key = threadTs
        ? `thread:${item.channelId}:${threadTs}`
        : item.kind === "reaction" && item.channelId
          ? `reaction:${item.channelId}:${item.ts}`
          : `single:${item.id}`;
      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = [];
        buckets.set(key, bucket);
      }
      bucket.push(item);
    }
    const nextCache = new Map<string, ActivityRowData>();
    const ordered = Array.from(buckets, ([key, bucketItems]) => {
      const cached = rowsCache.get(key);
      const row =
        cached && sameItems(cached.items, bucketItems)
          ? cached
          : { isThread: key.startsWith("thread:"), items: bucketItems, key };
      nextCache.set(key, row);
      return row;
    });
    rowsCache = nextCache;
    return ordered;
  });
  return rows;
}
