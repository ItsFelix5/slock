import { service } from "@slock/core/solid";
import { createEffect, createSignal, untrack } from "solid-js";
import { type TopUpState, topUpStep } from "./activityScroll";

const activityStore = service("activity");

export function createActivityTopUp(scope: {
  container: () => HTMLElement | undefined;
  key: () => string;
  rows: () => unknown;
  types: () => string | undefined;
  unreadOnly: () => boolean;
}) {
  const [scrolled, setScrolled] = createSignal(0);
  let topUp: TopUpState | undefined;

  createEffect(
    () => {
      scope.rows();
      scrolled();
      activityStore.activityFeed();
      activityStore.activityMore();
      return { key: scope.key(), types: scope.types(), unreadOnly: scope.unreadOnly() };
    },
    {
      effect: ({ key, types, unreadOnly }) =>
        untrack(() => {
          const step = topUpStep(topUp, key, scope.container());
          topUp = step.state;
          if (step.load) activityStore.loadMoreActivity(types, unreadOnly);
        }),
      error: () => {},
    },
  );

  return { onScroll: () => setScrolled((count) => count + 1) };
}
