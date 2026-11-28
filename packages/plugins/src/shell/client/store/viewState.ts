import { defined } from "@slock/core";
import { createEffect, createMemo, getOwner, onCleanup, runWithOwner, untrack } from "solid-js";
import type { PaneKind } from "../api";
import type { PaneContent } from "../api/types";
import {
  historyAction,
  type NavMark,
  type NavSnapshot,
  navSnapshotToPath,
  parseNavPath,
  parsesCompletely,
} from "./navHistory";
import type { createPanesSlice } from "./panes";

export function createViewStateSlice(deps: {
  defaultView: () => PaneContent | undefined;
  ready: () => boolean;
  paneKinds: () => PaneKind[];
  panes: Pick<
    ReturnType<typeof createPanesSlice>,
    | "activatePane"
    | "closePane"
    | "currentPanes"
    | "focusedPrimaryContent"
    | "insertContentPane"
    | "navigateFocusedPane"
    | "panes"
    | "setAllPanes"
    | "setPaneContent"
  >;
}) {
  const { panes } = deps;
  const paneKey = (content: PaneContent) =>
    JSON.stringify(
      deps
        .paneKinds()
        .find((kind) => kind.kind === content.kind)
        ?.identity?.(content) ?? content,
    );
  const lastPrimary = createMemo<PaneContent | null>(
    (previous) => panes.focusedPrimaryContent() ?? previous ?? null,
  );

  const activeContent = createMemo<PaneContent | null>(
    () => panes.focusedPrimaryContent() ?? lastPrimary() ?? deps.defaultView() ?? null,
  );

  function liveIdContentPairs(list: ReturnType<typeof panes.currentPanes>) {
    return list.flatMap((p) => (p.content ? [{ content: p.content, id: p.id }] : []));
  }

  function navSnapshotOf(list: ReturnType<typeof panes.currentPanes>): NavSnapshot {
    return { panes: liveIdContentPairs(list).map((p) => p.content) };
  }

  function reconcilePanesToward(target: PaneContent[]) {
    const live = liveIdContentPairs(panes.currentPanes());
    const eq = (a: PaneContent, b: PaneContent) => paneKey(a) === paneKey(b);

    let prefix = 0;
    while (
      prefix < live.length &&
      prefix < target.length &&
      eq(defined(live[prefix]).content, defined(target[prefix]))
    )
      prefix++;

    let suffix = 0;
    while (
      suffix < live.length - prefix &&
      suffix < target.length - prefix &&
      eq(
        defined(live[live.length - 1 - suffix]).content,
        defined(target[target.length - 1 - suffix]),
      )
    )
      suffix++;

    const liveMid = live.slice(prefix, live.length - suffix);
    const targetMid = target.slice(prefix, target.length - suffix);

    const shared = Math.min(liveMid.length, targetMid.length);
    let touched = liveMid[shared - 1]?.id;
    for (let i = 0; i < shared; i++)
      panes.setPaneContent(defined(liveMid[i]).id, defined(targetMid[i]));
    for (let i = liveMid.length - 1; i >= shared; i--) panes.closePane(defined(liveMid[i]).id);

    let afterId = liveMid[shared - 1]?.id ?? live[prefix - 1]?.id ?? null;
    for (let i = shared; i < targetMid.length; i++) {
      afterId = panes.insertContentPane(defined(targetMid[i]), afterId);
      touched = afterId;
    }
    if (touched) panes.activatePane(touched);
  }

  function structuralKey(snap: Pick<NavSnapshot, "panes">): string {
    return snap.panes.map(paneKey).join("/");
  }

  function markOf(serialized: string): NavMark {
    const snap: NavSnapshot = JSON.parse(serialized);
    return { key: structuralKey(snap), serialized };
  }

  function writeHistory(mark: NavMark, action: "push" | "replace"): NavMark {
    const snap: NavSnapshot = JSON.parse(mark.serialized);
    const entry = { slockNav: snap };
    const path = navSnapshotToPath(snap, deps.paneKinds());
    if (action === "replace") window.history.replaceState(entry, "", path);
    else window.history.pushState(entry, "", path);
    return mark;
  }

  const replaceHistory = (snap: NavSnapshot) =>
    writeHistory(markOf(JSON.stringify(snap)), "replace");

  const owner = getOwner();
  let started = false;

  function start() {
    if (started) return;
    started = true;
    untrack(() => {
      const initialPanes = parseNavPath(new URL(window.location.href), deps.paneKinds());
      panes.setAllPanes(initialPanes);
      runWithOwner(owner, () => installUrlSync(initialPanes));
    });
  }

  createEffect(
    () => parsesCompletely(new URL(window.location.href), deps.paneKinds()),
    (parses) => {
      if (parses) start();
    },
  );

  function installUrlSync(initialPanes: ReturnType<typeof parseNavPath>) {
    let last = replaceHistory({ panes: initialPanes });

    const onPopState = (e: PopStateEvent) => {
      const popped: NavSnapshot | undefined = e.state?.slockNav;
      if (!popped) return;

      reconcilePanesToward(popped.panes);
      last = replaceHistory(navSnapshotOf(panes.currentPanes()));
    };
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));

    createEffect(
      () => JSON.stringify(navSnapshotOf(panes.panes())),
      (serialized) => {
        untrack(() => {
          const next = markOf(serialized);
          const action = historyAction(last, next);
          if (action !== "skip") last = writeHistory(next, action);
        });
      },
    );

    createEffect(
      () => (panes.focusedPrimaryContent() ? null : activeContent()),
      (next) => {
        if (next) untrack(() => panes.navigateFocusedPane(next));
      },
    );
  }

  return {
    activeContent,
    ready: deps.ready,
    start,
  };
}
