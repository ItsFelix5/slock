import type { Channel, DirectMessage } from "@slock/types";
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { EMPTY_FILTERS, type SearchFilters } from "../../../searchQuery";
import { resolveCanvasPaneTitle } from "../entities/canvas";
import { isDmId } from "../entities/dms";
import type { Nav, PaneContent, View } from "../types";
import type { createPanesSlice } from "./panes";

interface NavSnapshot {
  nav: Nav;
  panes: PaneContent[];
  searchQuery?: string;
}

type BootstrapData = { channels: Channel[]; directMessages: DirectMessage[] } | undefined;

function conversationKindIn(id: string, data: BootstrapData): "channel" | "dm" {
  return isDmId(id, (candidate) => !!data?.directMessages.some((d) => d.id === candidate))
    ? "dm"
    : "channel";
}

export function resolveActiveView(
  nav: Nav,
  selected: View | null,
  data: BootstrapData,
): View | null {
  if (selected) {
    const kind = conversationKindIn(selected.id, data);
    return kind === selected.kind ? selected : { id: selected.id, kind };
  }
  if (nav !== "home" || !data) return null;
  const [firstChannel] = data.channels;
  if (firstChannel) return { id: firstChannel.id, kind: "channel" };
  const [firstDirectMessage] = data.directMessages;
  return firstDirectMessage ? { id: firstDirectMessage.id, kind: "dm" } : null;
}

function parsePaneSegment(segment: string, data: BootstrapData): PaneContent | null {
  if (!segment) return null;
  if (segment.startsWith("F")) return { fileId: segment, kind: "canvas", title: "" };
  if (segment.includes("~")) {
    const [channelId, rest] = segment.split("~");
    const pinned = rest.endsWith("!");
    const ts = pinned ? rest.slice(0, -1) : rest;
    return { channelId, kind: "thread", pinned: pinned || undefined, ts };
  }
  if (segment.endsWith("*")) return { channelId: segment.slice(0, -1), kind: "pinned" };
  if (segment.startsWith("U") || segment.startsWith("B"))
    return { kind: "profile", userId: segment };
  if (segment.startsWith("S")) return { kind: "usergroup-details", usergroupId: segment };
  return { id: segment, kind: conversationKindIn(segment, data) };
}

function paneKey(content: PaneContent): string {
  return JSON.stringify(content.kind === "canvas" ? { ...content, title: "" } : content);
}

function serializePaneSegment(content: PaneContent): string {
  switch (content.kind) {
    case "channel":
    case "dm":
      return content.id;
    case "thread":
      return `${content.channelId}~${content.ts}${content.pinned ? "!" : ""}`;
    case "usergroup-details":
      return content.usergroupId;
    case "pinned":
      return `${content.channelId}*`;
    case "canvas":
      return content.fileId;
    case "profile":
      return content.userId;
  }
}

function parseNavPath(url: URL, data: BootstrapData): PaneContent[] {
  return url.pathname
    .split("/")
    .filter(Boolean)
    .map((segment) => parsePaneSegment(segment, data))
    .filter((c): c is PaneContent => c !== null);
}

function navSnapshotToPath(snap: NavSnapshot): string {
  const path = `/${snap.panes.map(serializePaneSegment).join("/")}`;
  return snap.nav === "search" && snap.searchQuery
    ? `${path}?q=${encodeURIComponent(snap.searchQuery)}`
    : path;
}

export function createViewStateSlice(deps: {
  bootstrap: () => { channels: Channel[]; directMessages: DirectMessage[] } | undefined;
  panes: Pick<
    ReturnType<typeof createPanesSlice>,
    | "closePane"
    | "focusedConversationContent"
    | "insertContentPane"
    | "navigateFocusedPane"
    | "panes"
    | "setAllPanes"
    | "setPaneContent"
  >;
}) {
  const { panes } = deps;
  const [selected, setSelected] = createSignal<View | null>(null);
  const [nav, setNav] = createSignal<Nav>("home");
  const [searchScreenQuery, setSearchScreenQuery] = createSignal("");
  const [searchScreenFilters, setSearchScreenFilters] = createSignal<SearchFilters>(EMPTY_FILTERS);

  const activeView = createMemo<View | null>(() => {
    const data = deps.bootstrap();
    const live = panes.focusedConversationContent();
    if (live && (live.kind === "channel" || live.kind === "dm")) {
      const kind = conversationKindIn(live.id, data);
      return kind === live.kind ? live : { id: live.id, kind };
    }
    return resolveActiveView(nav(), selected(), data);
  });

  let lastNavSerialized: string | null = null;
  let lastStructuralKey: string | null = null;
  let syncingFromPopState = false;

  function liveIdContentPairs(): { id: string; content: PaneContent }[] {
    return panes.panes().flatMap((p) => (p.content ? [{ content: p.content, id: p.id }] : []));
  }

  function livePaneContents(): PaneContent[] {
    return liveIdContentPairs().map((p) => p.content);
  }

  function resolvePendingCanvasTitles() {
    for (const { id, content } of liveIdContentPairs()) {
      if (content.kind === "canvas" && !content.title) {
        resolveCanvasPaneTitle(id, content.fileId, panes.setPaneContent);
      }
    }
  }

  function reconcilePanesToward(target: PaneContent[]) {
    const live = liveIdContentPairs();
    const eq = (a: PaneContent, b: PaneContent) => paneKey(a) === paneKey(b);

    let prefix = 0;
    while (
      prefix < live.length &&
      prefix < target.length &&
      eq(live[prefix].content, target[prefix])
    )
      prefix++;

    let suffix = 0;
    while (
      suffix < live.length - prefix &&
      suffix < target.length - prefix &&
      eq(live[live.length - 1 - suffix].content, target[target.length - 1 - suffix])
    )
      suffix++;

    const liveMid = live.slice(prefix, live.length - suffix);
    const targetMid = target.slice(prefix, target.length - suffix);

    const shared = Math.min(liveMid.length, targetMid.length);
    for (let i = 0; i < shared; i++) panes.setPaneContent(liveMid[i].id, targetMid[i]);
    for (let i = liveMid.length - 1; i >= shared; i--) panes.closePane(liveMid[i].id);

    let afterId = liveMid[shared - 1]?.id ?? live[prefix - 1]?.id ?? null;
    for (let i = shared; i < targetMid.length; i++) {
      afterId = panes.insertContentPane(targetMid[i], afterId);
    }
  }

  function structuralKey(snap: Pick<NavSnapshot, "panes">): string {
    return snap.panes.map(paneKey).join("/");
  }

  function currentNavSnapshot(): NavSnapshot {
    return {
      nav: nav(),
      panes: livePaneContents(),
      searchQuery: nav() === "search" ? searchScreenQuery() : undefined,
    };
  }

  function pushOrReplace(snap: NavSnapshot, replace: boolean) {
    const serialized = JSON.stringify(snap);
    lastNavSerialized = serialized;
    const entry = { slockNav: JSON.parse(serialized) };
    const path = navSnapshotToPath(snap);
    if (replace) window.history.replaceState(entry, "", path);
    else window.history.pushState(entry, "", path);
  }

  if (typeof window !== "undefined") {
    const initialPanes = parseNavPath(new URL(window.location.href), untrack(deps.bootstrap));
    batch(() => {
      setSelected(
        initialPanes[0] && (initialPanes[0].kind === "channel" || initialPanes[0].kind === "dm")
          ? initialPanes[0]
          : null,
      );
      panes.setAllPanes(initialPanes);
    });
    resolvePendingCanvasTitles();
    const initialSnap: NavSnapshot = { nav: nav(), panes: initialPanes };
    pushOrReplace(initialSnap, true);
    lastStructuralKey = structuralKey(initialSnap);

    const onPopState = (e: PopStateEvent) => {
      const popped: NavSnapshot | undefined = e.state?.slockNav;
      if (!popped) return;

      syncingFromPopState = true;
      batch(() => {
        reconcilePanesToward(popped.panes);
        const focused = panes.focusedConversationContent();
        if (focused && (focused.kind === "channel" || focused.kind === "dm")) {
          setSelected(focused);
        }
      });
      resolvePendingCanvasTitles();

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
      const data = deps.bootstrap();
      if (!data) return;
      for (const pane of untrack(panes.panes)) {
        const c = pane.content;
        if (!c || (c.kind !== "channel" && c.kind !== "dm")) continue;
        const kind = conversationKindIn(c.id, data);
        if (kind !== c.kind) panes.setPaneContent(pane.id, { id: c.id, kind });
      }
    });

    createEffect(() => {
      if (panes.focusedConversationContent()) return;
      const view = resolveActiveView(nav(), selected(), deps.bootstrap());
      if (view) panes.navigateFocusedPane(view);
    });
  }

  return {
    activeView,
    nav,
    searchScreenFilters,
    searchScreenQuery,
    selected,
    setNav,
    setSearchScreenFilters,
    setSearchScreenQuery,
    setSelected,
  };
}
