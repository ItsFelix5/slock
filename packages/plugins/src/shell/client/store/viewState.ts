import { defined } from "@slock/core";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  getOwner,
  onCleanup,
  runWithOwner,
} from "solid-js";
import type { PaneKind } from "../api";
import type { PaneContent } from "../api/types";
import type { createPanesSlice } from "./panes";

interface NavSnapshot {
  panes: PaneContent[];
}

function parsePaneSegment(segment: string, kinds: PaneKind[]): PaneContent | null {
  if (!segment) return null;
  for (const kind of kinds) {
    const content = kind.url?.parse(segment);
    if (content) return content;
  }
  return null;
}

function serializePaneSegment(content: PaneContent, kinds: PaneKind[]): string {
  return kinds.find((kind) => kind.kind === content.kind)?.url?.serialize(content) ?? "";
}

function parseNavPath(url: URL, kinds: PaneKind[]): PaneContent[] {
  return url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => parsePaneSegment(segment, kinds))
    .filter((c): c is PaneContent => c !== null);
}

function navSnapshotToPath(snap: NavSnapshot, kinds: PaneKind[]): string {
  const segments = snap.panes.map((content) => serializePaneSegment(content, kinds));
  return `/${segments.filter(Boolean).join("/")}`;
}

export function createViewStateSlice(deps: {
  defaultView: () => PaneContent | undefined;
  ready: () => boolean;
  paneKinds: () => PaneKind[];
  panes: Pick<
    ReturnType<typeof createPanesSlice>,
    | "closePane"
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
  const [lastPrimary, setLastPrimary] = createSignal<PaneContent | null>(null);

  const activeContent = createMemo<PaneContent | null>(
    () => panes.focusedPrimaryContent() ?? lastPrimary() ?? deps.defaultView() ?? null,
  );

  let lastNavSerialized: string | null = null;
  let lastStructuralKey: string | null = null;
  let syncingFromPopState = false;

  function liveIdContentPairs(): { id: string; content: PaneContent }[] {
    return panes.panes().flatMap((p) => (p.content ? [{ content: p.content, id: p.id }] : []));
  }

  function livePaneContents(): PaneContent[] {
    return liveIdContentPairs().map((p) => p.content);
  }

  function reconcilePanesToward(target: PaneContent[]) {
    const live = liveIdContentPairs();
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
    for (let i = 0; i < shared; i++)
      panes.setPaneContent(defined(liveMid[i]).id, defined(targetMid[i]));
    for (let i = liveMid.length - 1; i >= shared; i--) panes.closePane(defined(liveMid[i]).id);

    let afterId = liveMid[shared - 1]?.id ?? live[prefix - 1]?.id ?? null;
    for (let i = shared; i < targetMid.length; i++) {
      afterId = panes.insertContentPane(defined(targetMid[i]), afterId);
    }
  }

  function structuralKey(snap: Pick<NavSnapshot, "panes">): string {
    return snap.panes.map(paneKey).join("/");
  }

  function currentNavSnapshot(): NavSnapshot {
    return { panes: livePaneContents() };
  }

  function pushOrReplace(snap: NavSnapshot, replace: boolean) {
    const serialized = JSON.stringify(snap);
    lastNavSerialized = serialized;
    const entry = { slockNav: JSON.parse(serialized) };
    const path = navSnapshotToPath(snap, deps.paneKinds());
    if (replace) window.history.replaceState(entry, "", path);
    else window.history.pushState(entry, "", path);
  }

  const owner = getOwner();
  let started = false;

  function start() {
    if (started) return;
    started = true;
    runWithOwner(owner, installUrlSync);
  }

  function installUrlSync() {
    const initialPanes = parseNavPath(new URL(window.location.href), deps.paneKinds());
    panes.setAllPanes(initialPanes);
    const initialSnap: NavSnapshot = { panes: initialPanes };
    pushOrReplace(initialSnap, true);
    lastStructuralKey = structuralKey(initialSnap);

    const onPopState = (e: PopStateEvent) => {
      const popped: NavSnapshot | undefined = e.state?.slockNav;
      if (!popped) return;

      syncingFromPopState = true;
      batch(() => {
        reconcilePanesToward(popped.panes);
      });

      const merged = currentNavSnapshot();
      pushOrReplace(merged, true);
      lastStructuralKey = structuralKey(merged);
      syncingFromPopState = false;
    };
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));

    createEffect(() => {
      const snap = currentNavSnapshot();
      if (JSON.stringify(snap) === lastNavSerialized) return;
      if (syncingFromPopState) return;
      const key = structuralKey(snap);
      const replace = key === lastStructuralKey;
      lastStructuralKey = key;
      pushOrReplace(snap, replace);
    });

    createEffect(() => {
      const content = panes.focusedPrimaryContent();
      if (content) setLastPrimary(content);
    });

    createEffect(() => {
      if (panes.focusedPrimaryContent()) return;
      const next = activeContent();
      if (next) panes.navigateFocusedPane(next);
    });
  }

  return {
    activeContent,
    ready: deps.ready,
    start,
  };
}
