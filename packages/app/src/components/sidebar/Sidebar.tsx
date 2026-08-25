import { plainKey, useEscapeClose, useShortcut } from "@slock/ui";
import { createEffect, createMemo, createSignal } from "solid-js";
import { sectionMoveTarget } from "../../lib/channelSectionMutations";
import { actionFeedback } from "../../lib/feedback";
import { consumeShareTarget, pendingShareText } from "../../lib/incomingLinks";
import { setSidebarVisible, sidebarVisible } from "../../lib/sidebarVisibility";
import { setSidebarWidth as setSharedSidebarWidth } from "../../lib/sidebarWidth";
import { store } from "../../lib/store";
import "./Sidebar.css";
import SidebarView from "./SidebarView";
import { buildCategories, type Category } from "./sidebarCategories";
import { useSidebarChannelCycle } from "./sidebarChannelCycle";

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
const FEED_DEFAULT_WIDTH = 420;
const FEED_MIN_WIDTH = 340;
const FEED_MAX_WIDTH = 640;
const SLACK_USER_ID = "USLACK";
export default function Sidebar() {
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  const [unreadDmsOpen, setUnreadDmsOpen] = createSignal(true);
  const [dmsOpen, setDmsOpen] = createSignal(true);
  const [appsOpen, setAppsOpen] = createSignal(true);
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [feedWidth, setFeedWidth] = createSignal(FEED_DEFAULT_WIDTH);
  const feedMode = createMemo(
    () =>
      store.viewState.nav() === "later" ||
      store.viewState.nav() === "activity" ||
      store.viewState.nav() === "search",
  );
  createEffect(() => setSharedSidebarWidth(feedMode() ? feedWidth() : width()));
  consumeShareTarget();
  const [searchOpen, setSearchOpen] = createSignal(!!pendingShareText());
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [unreadsOnly, setUnreadsOnly] = createSignal(false);
  useEscapeClose(() => setUnreadsOnly(false), unreadsOnly);
  const [sectionMenuOpen, setSectionMenuOpen] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [draggingSectionId, setDraggingSectionId] = createSignal<string | null>(null);
  const [dropTarget, setDropTarget] = createSignal<{ id: string; before: boolean } | null>(null);
  useShortcut({
    allowInInputs: true,
    handler: () => setSearchOpen(true),
    keys: "Ctrl/⌘ K",
    label: "Jump to a channel or person",
    match: (e) => (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k",
    scope: "general",
  });
  useShortcut({
    allowInInputs: true,
    allowRepeat: false,
    handler: () => store.viewState.openMessageSearch(""),
    keys: "Ctrl/⌘ F or G",
    label: "Search messages",
    match: (e) => (e.ctrlKey || e.metaKey) && !e.altKey && ["f", "g"].includes(e.key.toLowerCase()),
    scope: "general",
  });
  useSidebarChannelCycle();
  useShortcut({
    allowInInputs: true,
    handler: () => setSidebarVisible(!sidebarVisible()),
    keys: "Ctrl/⌘ \\",
    label: "Show or hide the sidebar",
    match: (e) => (e.ctrlKey || e.metaKey) && e.key === "\\",
    scope: "general",
  });
  useShortcut({
    enabled: () => !unreadsOnly(),
    handler: () => {
      store.viewState.setNavView("home");
      setUnreadsOnly(true);
    },
    keys: "Shift U",
    label: "Show unread channels only",
    match: plainKey("U"),
    scope: "general",
  });
  const toggleCategory = (id: string) => {
    const next = new Set(collapsed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };
  const toggleSectionFilter = (id: string) => store.channels.toggleSectionFilter(id);
  const categories = createMemo<Category[]>(() =>
    buildCategories(
      store.channels.channels(),
      store.channels.sections,
      unreadsOnly,
      store.unread.unreadChannelIds,
      store.channels.isChannelStarred,
      store.channels.isChannelLeft,
      (id) => {
        const view = store.viewState.activeView();
        return view?.kind === "channel" && view.id === id;
      },
      store.preferences.isChannelMuted,
    ),
  );
  const startRename = (cat: Category) => {
    setSectionMenuOpen(null);
    setRenamingId(cat.id);
    setRenameValue(cat.name);
  };
  const commitRename = async () => {
    if (store.channels.isSectionStructurePending()) return;
    const id = renamingId();
    const name = renameValue().trim();
    if (!(id && name)) {
      setRenamingId(null);
      return;
    }
    if (await store.channels.renameChannelSection(id, name)) setRenamingId(null);
  };
  let sectionListEl: HTMLDivElement | undefined;
  const setSectionListRef = (el: HTMLDivElement) => {
    sectionListEl = el;
  };
  const handleSectionDragStart = (e: DragEvent, id: string) => {
    if (store.channels.isSectionStructurePending()) {
      e.preventDefault();
      return;
    }
    setDraggingSectionId(id);
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };
  const handleSectionsDragOver = (e: DragEvent) => {
    const draggedId = draggingSectionId();
    if (!(draggedId && sectionListEl)) return;
    e.preventDefault();
    const rows = Array.from(
      sectionListEl.querySelectorAll<HTMLElement>('[data-reorderable="true"]'),
    ).filter((row) => row.dataset.sectionId !== draggedId);
    if (rows.length === 0) return;
    let bestId = rows[0].dataset.sectionId as string;
    let bestBefore = true;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const dist = Math.abs(e.clientY - row.getBoundingClientRect().top);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = row.dataset.sectionId as string;
        bestBefore = true;
      }
    }
    const last = rows[rows.length - 1];
    const bottomDist = Math.abs(e.clientY - last.getBoundingClientRect().bottom);
    if (bottomDist < bestDist) {
      bestId = last.dataset.sectionId as string;
      bestBefore = false;
    }
    setDropTarget({ before: bestBefore, id: bestId });
  };
  const handleSectionsDragLeave = (e: DragEvent) => {
    if (sectionListEl && e.relatedTarget instanceof Node && sectionListEl.contains(e.relatedTarget))
      return;
    setDropTarget(null);
  };
  const handleSectionDrop = (e: DragEvent) => {
    e.preventDefault();
    const draggedId = draggingSectionId();
    const target = dropTarget();
    setDraggingSectionId(null);
    setDropTarget(null);
    if (
      !(draggedId && target) ||
      draggedId === target.id ||
      store.channels.isSectionStructurePending()
    )
      return;
    const otherReorderableIds = categories()
      .filter((c) => c.reorderable && c.id !== draggedId)
      .map((c) => c.id);
    const targetIndex = otherReorderableIds.indexOf(target.id);
    const nextSectionId = target.before
      ? target.id
      : (otherReorderableIds[targetIndex + 1] ?? null);
    void store.channels.reorderChannelSection(draggedId, nextSectionId);
  };
  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDropTarget(null);
  };
  const sectionMoveTargetFor = (id: string, direction: -1 | 1) =>
    sectionMoveTarget(
      categories()
        .filter((category) => category.reorderable)
        .map((category) => category.id),
      id,
      direction,
    );
  const canMoveSection = (id: string, direction: -1 | 1) =>
    sectionMoveTargetFor(id, direction) !== undefined;
  const moveSection = (id: string, direction: -1 | 1) => {
    const target = sectionMoveTargetFor(id, direction);
    if (target === undefined || store.channels.isSectionStructurePending()) return;
    setSectionMenuOpen(null);
    void store.channels.reorderChannelSection(id, target);
  };
  const isDmUnread = (dm: { id: string }) =>
    !!store.unread.unreadChannelIds[dm.id] && !store.preferences.isChannelMuted(dm.id);
  const visibleDms = createMemo(() =>
    store.dms.directMessages().filter((dm) => {
      const view = store.viewState.activeView();
      const isOpen = view?.kind === "dm" && view.id === dm.id;
      return isOpen || !unreadsOnly() || isDmUnread(dm);
    }),
  );
  const unreadDms = createMemo(() => visibleDms().filter(isDmUnread));

  const peopleDms = createMemo(() =>
    visibleDms().filter(
      (dm) =>
        !isDmUnread(dm) &&
        (!dm.userId || (dm.userId !== SLACK_USER_ID && !store.users.userById(dm.userId)?.isBot)),
    ),
  );
  const appDms = createMemo(() =>
    visibleDms().filter(
      (dm) =>
        !isDmUnread(dm) &&
        !!dm.userId &&
        (dm.userId === SLACK_USER_ID || store.users.userById(dm.userId)?.isBot),
    ),
  );
  const context = {
    actionFeedback,
    appDms,
    appsOpen,
    bootstrap: store.resources.bootstrap,
    canMoveSection,
    categories,
    collapsed,
    commitRename,
    currentUser: store.users.currentUser,
    deleteChannelSection: store.channels.deleteChannelSection,
    dmsOpen,
    draggingSectionId,
    dropTarget,
    feedMaxWidth: FEED_MAX_WIDTH,
    feedMinWidth: FEED_MIN_WIDTH,
    feedMode,
    feedWidth,
    handleSectionDragEnd,
    handleSectionDragStart,
    handleSectionDrop,
    handleSectionsDragLeave,
    handleSectionsDragOver,
    setSectionListRef,
    hasUnreadActivity: store.activity.hasUnreadActivity,
    unreadPingCount: store.activity.unreadPingCount,
    recentReactionEmoji: store.activity.recentReactionEmoji,
    maxWidth: MAX_WIDTH,
    minWidth: MIN_WIDTH,
    moveSection,
    nav: store.viewState.nav,
    openUserProfile: store.users.openUserProfile,
    peopleDms,
    preferencesError: () => store.resources.userPrefs.error,
    preferencesLoading: () => store.resources.userPrefs.loading,
    isSectionSidebarPending: store.channels.isSectionSidebarPending,
    renameValue,
    renamingId,
    retryPreferences: store.resources.retryUserPrefs,
    retrySections: store.channels.retrySections,
    setRenamingId,
    searchOpen,
    sectionMenuOpen,
    sectionsError: store.channels.sectionsError,
    sectionsLoading: store.channels.sectionsLoading,
    sectionStructurePending: store.channels.isSectionStructurePending,
    setAppsOpen,
    setDmsOpen,
    setUnreadDmsOpen,
    toggleSectionFilter,
    setFeedWidth,
    setNavView: store.viewState.setNavView,
    setRenameValue,
    setSearchOpen,
    setSectionMenuOpen,
    setChannelSectionSidebar: store.channels.setChannelSectionSidebar,
    setSettingsOpen,
    settingsOpen,
    setSidebarVisible,
    setUnreadsOnly,
    setWidth,
    sidebarVisible,
    startRename,
    toggleCategory,
    unreadChannelIds: store.unread.unreadChannelIds,
    unreadDms,
    unreadDmsOpen,
    unreadsOnly,
    width,
  };
  return <SidebarView context={context} />;
}
