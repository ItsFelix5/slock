import type { ActivityItem } from "@slock/types";
import { createStore } from "solid-js";

export type ActivityItems = ReturnType<typeof createActivityItems>;

export function createActivityItems() {
  const [list, setList] = createStore<ActivityItem[]>([]);

  return {
    insertByTime(item: ActivityItem) {
      setList((items) => {
        const olderIndex = items.findIndex((existing) => existing.time < item.time);
        items.splice(olderIndex === -1 ? items.length : olderIndex, 0, item);
      });
    },
    list,
    patchWhere(matches: (item: ActivityItem) => boolean, patch: Partial<ActivityItem>) {
      setList((items) => {
        for (const item of items) if (matches(item)) Object.assign(item, patch);
      });
    },
    removeWhere(matches: (item: ActivityItem) => boolean) {
      setList((items) => {
        for (let index = items.length - 1; index >= 0; index--) {
          const item = items[index];
          if (item && matches(item)) items.splice(index, 1);
        }
      });
    },
    update(change: (items: ActivityItem[]) => void) {
      setList(change);
    },
  };
}
