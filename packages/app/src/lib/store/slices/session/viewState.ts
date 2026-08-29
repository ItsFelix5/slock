import { consumeMouseButtonPop, focusedPaneId, hoveredPaneId } from "@slock/ui";
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import type { Channel, DirectMessage } from "../../../api";
import { isDmId } from "../../../dmId";
import { EMPTY_FILTERS, type SearchFilters } from "../../../searchQuery";
import type { Nav, PaneContent, View } from "../types";
import type { createPanesSlice } from "./panes";

interface NavSnapshot {
  nav: Nav;
  panes: PaneContent[];
  searchQuery?: string;
}

type RawPane = { kind: "raw"; id: string };

function conversationKindIn(
  id: string,
  data: { directMessages: DirectMessage[] } | undefined,
): "channel" | "dm" {
  return isDmId(id, (candidate) => !!data?.directMessages.some((d) => d.id === candidate))
    ? "dm"
    : "channel";
}

export function resolveActiveView(
  nav: Nav,
  selected: View | null,
  data: { channels: Channel[]; directMessages: DirectMessage[] } | undefined,
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

function parsePaneSegment(segment: string): PaneContent | RawPane | null {
  if (!segment) return null;
  if (segment.includes("~")) {
    const [channelId, rest] = segment.split("~");
    const pinned = rest.endsWith("!");
    const ts = pinned ? rest.slice(0, -1) : rest;
    return { channelId, kind: "thread", pinned: pinned || undefined, ts };
  }
  if (segment.endsWith("*")) return { channelId: segment.slice(0, -1), kind: "pinned" };
  if (segment.includes("^")) {
    const [fileId, title] = segment.split("^");
    return { fileId, kind: "canvas", title: decodeURIComponent(title) };
  }
  if (segment.startsWith("U")) return { kind: "profile", userId: segment };
  if (segment.startsWith("S")) return { kind: "usergroup-details", usergroupId: segment };
  return { id: segment, kind: "raw" };
}

function resolvePaneContent(
  raw: PaneContent | RawPane,
  data: { channels: Channel[]; directMessages: DirectMessage[] } | undefined,
): PaneContent {
  if (raw.kind !== "raw") return raw;
  return { id: raw.id, kind: conversationKindIn(raw.id, data) };
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
      return `${content.fileId}^${encodeURIComponent(content.title)}`;
    case "profile":
      return content.userId;
  }
}

function parseNavPath(url: URL): {
  nav: Nav;
  rawPanes: (PaneContent | RawPane)[];
  searchQuery?: string;
} {
  const segs = url.pathname.split("/").filter(Boolean);
  const [firstSegment] = segs;

  let nav: Nav = "home";
  let searchQuery: string | undefined;
  if (firstSegment === "search") {
    nav = "search";
    segs.shift();
    searchQuery = url.searchParams.get("q") ?? undefined;
  } else if (firstSegment === "activity" || firstSegment === "later") {
    nav = firstSegment;
    segs.shift();
  }

  const rawPanes = segs.map(parsePaneSegment).filter((c): c is PaneContent | RawPane => c !== null);
  return { nav, rawPanes, searchQuery };
}

function navSnapshotToPath(snap: NavSnapshot): string {
  const parts: string[] = [];
  if (snap.nav !== "home") parts.push(snap.nav);
  parts.push(...snap.panes.map(serializePaneSegment));
  const path = `/${parts.join("/")}`;
  return snap.nav === "search" && snap.searchQuery
    ? `${path}?q=${encodeURIComponent(snap.searchQuery)}`
    : path;
}

export function createViewStateSlice(deps: {
  bootstrap: () => { channels: Channel[]; directMessages: DirectMessage[] } | undefined;
  panes: Pick<
    ReturnType<typeof createPanesSlice>,
    "closePane" | "currentFocusedId" | "panes" | "setAllPanes" | "setPaneContent"
  >;
}) {
  const { panes } = deps;
  const [selected, setSelected] = createSignal<View | null>(null);
  const [nav, setNav] = createSignal<Nav>("home");
  const [searchScreenQuery, setSearchScreenQuery] = createSignal("");
  const [searchScreenFilters, setSearchScreenFilters] = createSignal<SearchFilters>(EMPTY_FILTERS);

  const activeView = createMemo<View | null>(() =>
    resolveActiveView(nav(), selected(), deps.bootstrap()),
  );

  let lastNavSerialized: string | null = null;
  let lastStructuralKey: string | null = null;
  let syncingFromPopState = false;

  function livePaneContents(): PaneContent[] {
    return panes.panes().flatMap((p) => (p.content ? [p.content] : []));
  }

  function structuralKey(snap: Pick<NavSnapshot, "nav" | "panes">): string {
    return JSON.stringify({ nav: snap.nav, panes: snap.panes });
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
    const entry = { slockNav: JSON.parse(serialized) as NavSnapshot };
    const path = navSnapshotToPath(snap);
    if (replace) window.history.replaceState(entry, "", path);
    else window.history.pushState(entry, "", path);
  }

  if (typeof window !== "undefined") {
    const initial = parseNavPath(new URL(window.location.href));
    const initialData = untrack(deps.bootstrap);
    const initialPanes = initial.rawPanes.map((raw) => resolvePaneContent(raw, initialData));
    batch(() => {
      setNav(initial.nav);
      setSelected(
        initialPanes[0] && (initialPanes[0].kind === "channel" || initialPanes[0].kind === "dm")
          ? initialPanes[0]
          : null,
      );
      panes.setAllPanes(initialPanes);
      if (initial.nav === "search" && initial.searchQuery)
        setSearchScreenQuery(initial.searchQuery);
    });
    const initialSnap: NavSnapshot = {
      nav: initial.nav,
      panes: initialPanes,
      searchQuery: initial.searchQuery,
    };
    pushOrReplace(initialSnap, true);
    lastStructuralKey = structuralKey(initialSnap);

    const onPopState = (e: PopStateEvent) => {
      const popped = (e.state as { slockNav?: NavSnapshot } | null)?.slockNav;
      if (!popped) return;

      const usedMouseButton = consumeMouseButtonPop();
      const targetId =
        (usedMouseButton && hoveredPaneId()) || focusedPaneId() || panes.currentFocusedId();

      const live = panes.panes();
      const targetIndex = live.findIndex((p) => p.id === targetId);
      const index = targetIndex === -1 ? 0 : targetIndex;
      const targetPaneId = live[index]?.id;

      syncingFromPopState = true;
      batch(() => {
        setNav(popped.nav);
        if (popped.nav === "search") setSearchScreenQuery(popped.searchQuery ?? "");
        if (targetPaneId) {
          const poppedContent = popped.panes[index];
          if (poppedContent) {
            panes.setPaneContent(targetPaneId, poppedContent);
            if (poppedContent.kind === "channel" || poppedContent.kind === "dm") {
              setSelected(poppedContent);
            }
          } else {
            panes.closePane(targetPaneId);
          }
        }
      });

      const merged: NavSnapshot = {
        nav: popped.nav,
        panes: livePaneContents(),
        searchQuery: popped.nav === "search" ? popped.searchQuery : undefined,
      };
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
