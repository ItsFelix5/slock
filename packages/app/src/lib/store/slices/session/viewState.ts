import type { Channel, DirectMessage } from "@slock/slack-api";
import { consumeMouseButtonPop, focusedPaneId, hoveredPaneId } from "@slock/ui";
import { batch, createEffect, createMemo, createSignal, onCleanup, untrack } from "solid-js";
import { isDmId } from "../../../dmId";
import { EMPTY_FILTERS, type SearchFilters } from "../../../searchQuery";
import type { ChannelDetailsTab, Nav, PaneContent, View } from "../types";
import type { createPanesSlice } from "./panes";

interface NavSnapshot {
  nav: Nav;
  panes: PaneContent[];
}

type RawPane = { kind: "raw"; id: string };

export function resolveActiveView(
  nav: Nav,
  selected: View | null,
  data: { channels: Channel[]; directMessages: DirectMessage[] } | undefined,
): View | null {
  if (selected) {
    const isDm = isDmId(selected.id, (id) => !!data?.directMessages.some((d) => d.id === id));
    const kind = isDm ? "dm" : "channel";
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
  if (segment.includes("+")) {
    const [channelId, tab] = segment.split("+");
    return { channelId, kind: "channel-details", tab: (tab || undefined) as ChannelDetailsTab };
  }
  if (segment.endsWith("*")) return { channelId: segment.slice(0, -1), kind: "pinned" };
  if (segment.startsWith("U")) return { kind: "profile", userId: segment };
  if (segment.startsWith("S")) return { kind: "usergroup-details", usergroupId: segment };
  return { id: segment, kind: "raw" };
}

function resolvePaneContent(
  raw: PaneContent | RawPane,
  data: { channels: Channel[]; directMessages: DirectMessage[] } | undefined,
): PaneContent {
  if (raw.kind !== "raw") return raw;
  const isDm = isDmId(raw.id, (id) => !!data?.directMessages.some((d) => d.id === id));
  return { id: raw.id, kind: isDm ? "dm" : "channel" };
}

function serializePaneSegment(content: PaneContent): string {
  switch (content.kind) {
    case "channel":
    case "dm":
      return content.id;
    case "thread":
      return `${content.channelId}~${content.ts}${content.pinned ? "!" : ""}`;
    case "channel-details":
      return `${content.channelId}+${content.tab ?? "about"}`;
    case "usergroup-details":
      return content.usergroupId;
    case "pinned":
      return `${content.channelId}*`;
    case "profile":
      return content.userId;
  }
}

function parseNavPath(url: URL): { nav: Nav; rawPanes: (PaneContent | RawPane)[] } {
  const segs = url.pathname.split("/").filter(Boolean);
  const [firstSegment] = segs;
  if (firstSegment === "search") return { nav: "search", rawPanes: [] };

  let nav: Nav = "home";
  if (firstSegment === "activity" || firstSegment === "later") {
    nav = firstSegment;
    segs.shift();
  }

  const rawPanes = segs.map(parsePaneSegment).filter((c): c is PaneContent | RawPane => c !== null);
  return { nav, rawPanes };
}

function navSnapshotToPath(snap: NavSnapshot): string {
  const parts: string[] = [];
  if (snap.nav === "search") {
    parts.push("search");
  } else {
    if (snap.nav !== "home") parts.push(snap.nav);
    parts.push(...snap.panes.map(serializePaneSegment));
  }
  return `/${parts.join("/")}`;
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

  function livePaneContents(): PaneContent[] {
    return panes.panes().flatMap((p) => (p.content ? [p.content] : []));
  }

  function currentNavSnapshot(): NavSnapshot {
    return { nav: nav(), panes: livePaneContents() };
  }

  function pushOrReplace(snap: NavSnapshot, replace: boolean) {
    const serialized = JSON.stringify(snap);
    lastNavSerialized = serialized;
    // panes/content come from a Solid store (reactive proxies), which history.pushState's
    // structured-clone can't handle — round-trip through JSON to get a plain, cloneable object
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
    });
    pushOrReplace({ nav: initial.nav, panes: initialPanes }, true);

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

      setNav(popped.nav);
      if (targetPaneId) {
        const poppedContent = popped.panes[index];
        if (poppedContent) panes.setPaneContent(targetPaneId, poppedContent);
        else panes.closePane(targetPaneId);
      }

      const merged: NavSnapshot = { nav: popped.nav, panes: livePaneContents() };
      pushOrReplace(merged, true);
    };
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));

    createEffect(() => {
      const snap = currentNavSnapshot();
      if (JSON.stringify(snap) === lastNavSerialized) return;
      pushOrReplace(snap, false);
    });

    // panes parsed before bootstrap loaded may have guessed channel-vs-dm from the id
    // prefix alone (mpim ids are ambiguous) — correct any that data now resolves differently
    createEffect(() => {
      const data = deps.bootstrap();
      if (!data) return;
      for (const pane of untrack(panes.panes)) {
        const c = pane.content;
        if (!c || (c.kind !== "channel" && c.kind !== "dm")) continue;
        const isDm = isDmId(c.id, (id) => data.directMessages.some((d) => d.id === id));
        const kind = isDm ? "dm" : "channel";
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
