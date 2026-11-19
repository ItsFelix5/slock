import { createEffect } from "solid-js";
import {
  historyLoadOnScroll,
  historyLoadToFillViewport,
  type ScrollDirection,
} from "../../../lib/scrollMath";

export function createFeedPagination(deps: {
  scroller: () => HTMLElement | undefined;
  ready: () => boolean;
  size: () => number;
  busy: () => boolean;
  canLoadOlder: () => boolean;
  canLoadNewer: () => boolean;
  loadOlder: () => void;
  loadNewer: () => void;
}) {
  let sizeAtLayoutLoad: number | undefined;
  let lastLoad: ScrollDirection | undefined;

  function layoutLoad(el: HTMLElement) {
    const availability = { canLoadNewer: deps.canLoadNewer(), canLoadOlder: deps.canLoadOlder() };
    const edge =
      historyLoadOnScroll({ ...availability, direction: undefined, metrics: el }) ??
      historyLoadOnScroll({ ...availability, direction: "newer", metrics: el });
    if (edge && (lastLoad === undefined || edge === lastLoad)) return edge;
    return historyLoadToFillViewport(el, availability);
  }

  function nextLoad(el: HTMLElement, direction: ScrollDirection | undefined) {
    if (direction) {
      return historyLoadOnScroll({
        canLoadNewer: deps.canLoadNewer(),
        canLoadOlder: deps.canLoadOlder(),
        direction,
        metrics: el,
      });
    }
    if (deps.size() === sizeAtLayoutLoad) return;
    return layoutLoad(el);
  }

  function check(direction: ScrollDirection | undefined) {
    const el = deps.scroller();
    if (!(el && deps.ready()) || deps.busy()) return;
    const load = nextLoad(el, direction);
    if (!load) return;
    if (!direction) sizeAtLayoutLoad = deps.size();
    lastLoad = load;
    if (load === "older") deps.loadOlder();
    else deps.loadNewer();
  }

  createEffect(
    () => [deps.ready(), deps.busy(), deps.size()],
    () => check(undefined),
  );

  return {
    check,
    reset() {
      sizeAtLayoutLoad = undefined;
      lastLoad = undefined;
    },
  };
}
