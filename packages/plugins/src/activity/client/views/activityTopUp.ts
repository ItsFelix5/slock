import { service } from "@slock/core/solid";
import { createEffect, createSignal } from "solid-js";
import { loadMoreReason } from "./activityScroll";

const activityStore = service("activity");

export function createActivityTopUp(scope: {
  container: () => HTMLElement | undefined;
  key: () => string;
  rows: () => unknown;
  types: () => string | undefined;
  unreadOnly: () => boolean;
}) {
  const [scrolled, setScrolled] = createSignal(0);
  let attemptsKey: string | undefined;
  let attempts = 0;

  createEffect(
    () => {
      scope.rows();
      scrolled();
      activityStore.activityFeed();
      activityStore.activityMore();
      return { key: scope.key(), types: scope.types(), unreadOnly: scope.unreadOnly() };
    },
    {
      effect: ({ key, types, unreadOnly }) => {
        if (key !== attemptsKey) {
          attemptsKey = key;
          attempts = 0;
        }
        const el = scope.container();
        if (!el) return;
        const reason = loadMoreReason(el, attempts);
        if (!reason) return;
        if (reason === "top-up") attempts++;
        activityStore.loadMoreActivity(types, unreadOnly);
      },
      error: () => {},
    },
  );

  return { onScroll: () => setScrolled((count) => count + 1) };
}
