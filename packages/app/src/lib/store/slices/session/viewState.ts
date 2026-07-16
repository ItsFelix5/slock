import type { Channel, DirectMessage } from "@slock/slack-api";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { EMPTY_FILTERS, type SearchFilters } from "../../../searchQuery";
import type { ChannelMessageTarget, Nav, ThreadRef, View } from "../types";

interface NavSnapshot {
  nav: Nav;
  thread: ThreadRef | null;
  view: View | null;
}

// DM conversation ids are Slack "D..." ims (see bootstrap.ts); everything
// else selectable (public/private channels) is a "C..." id. That's enough
// to tell channel and DM URLs apart without a /channel/ or /dm/ segment.
function parseNavPath(url: URL): NavSnapshot {
  const segs = url.pathname.split("/").filter(Boolean);
  const [firstSegment] = segs;
  if (firstSegment === "search") return { nav: "search", thread: null, view: null };

  let nav: Nav = "home";
  if (firstSegment === "activity" || firstSegment === "later") {
    nav = firstSegment;
    segs.shift();
  }

  const [id] = segs;
  const view: View | null = id ? { id, kind: id.startsWith("D") ? "dm" : "channel" } : null;

  const ts = url.searchParams.get("t");
  const thread: ThreadRef | null = ts && view ? { channelId: view.id, ts } : null;

  return { nav, thread, view };
}

function navSnapshotToPath(snap: NavSnapshot): string {
  const parts: string[] = [];
  if (snap.nav === "search") {
    parts.push("search");
  } else {
    if (snap.nav !== "home") parts.push(snap.nav);
    if (snap.view) parts.push(snap.view.id);
  }
  const path = `/${parts.join("/")}`;
  return snap.thread ? `${path}?t=${encodeURIComponent(snap.thread.ts)}` : path;
}

// Raw navigation state: which view/tab/thread is selected, plus the browser
// history <-> in-app-navigation sync. Side effects that reach into other
// slices (clearing unread state, DM re-opening, etc.) live one layer up in
// the composed setActiveView/setNavView in store/index.ts — this slice only
// knows about "where am I", not what opening a view should also do.
export function createViewStateSlice(deps: {
  bootstrap: () => { channels: Channel[]; directMessages: DirectMessage[] } | undefined;
}) {
  const [selected, setSelected] = createSignal<View | null>(null);
  const [nav, setNav] = createSignal<Nav>("home");
  const [searchScreenQuery, setSearchScreenQuery] = createSignal("");
  const [searchScreenFilters, setSearchScreenFilters] = createSignal<SearchFilters>(EMPTY_FILTERS);
  const [activeThread, setActiveThread] = createSignal<ThreadRef | null>(null);
  const [channelMessageTarget, setChannelMessageTarget] = createSignal<ChannelMessageTarget | null>(
    null,
  );

  const activeView = createMemo<View | null>(() => {
    const explicit = selected();
    if (explicit) return explicit;
    const data = deps.bootstrap();
    if (!data) return null;
    const [firstChannel] = data.channels;
    if (firstChannel) return { id: firstChannel.id, kind: "channel" };
    const [firstDirectMessage] = data.directMessages;
    if (firstDirectMessage) return { id: firstDirectMessage.id, kind: "dm" };
    return null;
  });

  // ---- browser history integration (back/forward navigates views) ----
  // Every view change (channel/dm selection, tab, open thread) is mirrored into
  // window.history — as a real path, not just a state blob, so the address bar
  // reflects where you are and a hard refresh/pasted link lands back there.
  // `lastNavSerialized` de-dupes and, crucially, is primed on popstate so the
  // effect that re-runs after we restore a snapshot recognises it as a no-op
  // and doesn't push the restored state back on top of the stack.
  let lastNavSerialized: string | null = null;

  function currentNavSnapshot(): NavSnapshot {
    return { nav: nav(), thread: activeThread(), view: selected() };
  }

  function applyNavSnapshot(snap: NavSnapshot) {
    setChannelMessageTarget(null);
    setSelected(snap.view ?? null);
    setNav(snap.nav ?? "home");
    setActiveThread(snap.thread ?? null);
  }

  if (typeof window !== "undefined") {
    applyNavSnapshot(parseNavPath(new URL(window.location.href)));

    const onPopState = (e: PopStateEvent) => {
      const snap = (e.state as { slockNav?: NavSnapshot } | null)?.slockNav;
      if (!snap) return;
      lastNavSerialized = JSON.stringify(snap);
      applyNavSnapshot(snap);
    };
    window.addEventListener("popstate", onPopState);
    onCleanup(() => window.removeEventListener("popstate", onPopState));

    createEffect(() => {
      const snap = currentNavSnapshot();
      const serialized = JSON.stringify(snap);
      if (serialized === lastNavSerialized) return;
      const isFirst = lastNavSerialized === null;
      lastNavSerialized = serialized;
      const entry = { slockNav: snap };
      const path = navSnapshotToPath(snap);
      if (isFirst) window.history.replaceState(entry, "", path);
      else window.history.pushState(entry, "", path);
    });
  }

  return {
    activeThread,
    activeView,
    channelMessageTarget,
    nav,
    searchScreenFilters,
    searchScreenQuery,
    selected,
    setActiveThread,
    setChannelMessageTarget,
    setNav,
    setSearchScreenFilters,
    setSearchScreenQuery,
    setSelected,
  };
}
