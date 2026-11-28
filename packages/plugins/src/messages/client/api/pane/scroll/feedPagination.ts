import { createEffect, untrack } from "solid-js";
import { nextFeedLoad } from "../../../lib/feedLoadDecision";
import type { ScrollDirection } from "../../../lib/scrollMath";

export function createFeedPagination(deps: {
  scroller: () => HTMLElement | undefined;
  ready: () => boolean;
  size: () => number;
  busy: () => boolean;
  canLoadOlder: () => boolean;
  canLoadNewer: () => boolean;
  loadOlder: () => void;
  loadNewer: () => void;
  settle: () => void;
}) {
  let sizeAtLayoutLoad: number | undefined;
  let lastLoad: ScrollDirection | undefined;

  function check(direction: ScrollDirection | undefined) {
    const el = deps.scroller();
    if (!(el && deps.ready()) || deps.busy()) return;
    const load = nextFeedLoad({
      availability: { canLoadNewer: deps.canLoadNewer(), canLoadOlder: deps.canLoadOlder() },
      direction,
      lastLoad,
      metrics: el,
      size: deps.size(),
      sizeAtLayoutLoad,
    });
    if (!load) return;
    if (!direction) sizeAtLayoutLoad = deps.size();
    lastLoad = load;
    if (load === "older") deps.loadOlder();
    else deps.loadNewer();
  }

  createEffect(
    () => [deps.ready(), deps.busy(), deps.size()],
    () =>
      void untrack(() => {
        deps.settle();
        check(undefined);
      }),
  );

  return {
    check,
    reset() {
      sizeAtLayoutLoad = undefined;
      lastLoad = undefined;
    },
  };
}
