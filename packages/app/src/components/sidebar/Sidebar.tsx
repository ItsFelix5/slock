import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { actionFeedback, store } from "../../lib/store";
import SidebarView from "./SidebarView";
import { buildCategories, type Category } from "./sidebarCategories";
import "./Sidebar.css";

const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 420;
const FEED_DEFAULT_WIDTH = 420;
const FEED_MIN_WIDTH = 340;
const FEED_MAX_WIDTH = 640;
export default function Sidebar() {
  const [collapsed, setCollapsed] = createSignal<Set<string>>(new Set());
  const [dmsOpen, setDmsOpen] = createSignal(true);
  const [appsOpen, setAppsOpen] = createSignal(true);
  const [width, setWidth] = createSignal(DEFAULT_WIDTH);
  const [feedWidth, setFeedWidth] = createSignal(FEED_DEFAULT_WIDTH);
  const feedMode = createMemo(
    () => store.viewState.nav() === "later" || store.viewState.nav() === "activity",
  );
  const [searchOpen, setSearchOpen] = createSignal(false);
  const [settingsOpen, setSettingsOpen] = createSignal(false);
  const [unreadsOnly, setUnreadsOnly] = createSignal(false);
  // Clicking a section name temporarily reveals all its store.channels.channels. The caret
  // remains solely responsible for collapsing that section.
  const [expandedSectionIds, setExpandedSectionIds] = createSignal<Set<string>>(new Set());
  const [sectionMenuOpen, setSectionMenuOpen] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [draggingSectionId, setDraggingSectionId] = createSignal<string | null>(null);
  const [dropTarget, setDropTarget] = createSignal<{ id: string; before: boolean } | null>(null);
  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });
  const toggleCategory = (id: string) => {
    const next = new Set(collapsed());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
  };
  const showAllInCategory = (id: string) => {
    const next = new Set(expandedSectionIds());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedSectionIds(next);
  };
  const categories = createMemo<Category[]>(() =>
    buildCategories(
      store.channels.channels(),
      store.channels.sections,
      unreadsOnly,
      expandedSectionIds,
      store.unread.unreadChannelIds,
      store.channels.isChannelStarred,
      store.channels.isChannelLeft,
    ),
  );
  const startRename = (cat: Category) => {
    setSectionMenuOpen(null);
    setRenamingId(cat.id);
    setRenameValue(cat.name);
  };
  const commitRename = () => {
    const id = renamingId();
    const name = renameValue().trim();
    setRenamingId(null);
    if (id && name) store.channels.renameChannelSection(id, name);
  };
  const handleSectionDragStart = (e: DragEvent, id: string) => {
    setDraggingSectionId(id);
    e.dataTransfer?.setData("text/plain", id);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
  };
  const handleSectionDragOver = (e: DragEvent, id: string) => {
    if (!draggingSectionId() || draggingSectionId() === id) return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropTarget({ before: e.clientY < rect.top + rect.height / 2, id });
  };
  const handleSectionDragLeave = (id: string) => {
    setDropTarget((t) => (t?.id === id ? null : t));
  };
  const handleSectionDrop = (e: DragEvent) => {
    e.preventDefault();
    const draggedId = draggingSectionId();
    const target = dropTarget();
    setDraggingSectionId(null);
    setDropTarget(null);
    if (!(draggedId && target) || draggedId === target.id) return;
    const otherReorderableIds = categories()
      .filter((c) => c.reorderable && c.id !== draggedId)
      .map((c) => c.id);
    const targetIndex = otherReorderableIds.indexOf(target.id);
    const nextSectionId = target.before
      ? target.id
      : (otherReorderableIds[targetIndex + 1] ?? null);
    store.channels.reorderChannelSection(draggedId, nextSectionId);
  };
  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDropTarget(null);
  };
  const filteredDms = createMemo(() =>
    store.dms
      .directMessages()
      .filter((dm) => !unreadsOnly() || !!store.unread.unreadChannelIds[dm.id]),
  );
  // A multi-person DM (memberIds instead of a single userId) is never a bot
  // DM, so it always sorts into people.
  const peopleDms = createMemo(() =>
    filteredDms().filter((dm) => !(dm.userId && store.users.userById(dm.userId)?.isBot)),
  );
  const appDms = createMemo(() =>
    filteredDms().filter((dm) => dm.userId && store.users.userById(dm.userId)?.isBot),
  );
  return (
    <SidebarView
      context={{
        actionFeedback,
        appDms,
        appsOpen,
        bootstrap: store.resources.bootstrap,
        categories,
        collapsed,
        commitRename,
        currentUser: store.users.currentUser,
        deleteChannelSection: store.channels.deleteChannelSection,
        dmsOpen,
        expandedSectionIds,
        draggingSectionId,
        dropTarget,
        FEED_MAX_WIDTH,
        FEED_MIN_WIDTH,
        feedMode,
        feedWidth,
        handleSectionDragEnd,
        handleSectionDragLeave,
        handleSectionDragOver,
        handleSectionDragStart,
        handleSectionDrop,
        hasUnreadGlow: store.activity.hasUnreadGlow,
        hasUnreadPing: store.activity.hasUnreadPing,
        MAX_WIDTH,
        MIN_WIDTH,
        nav: store.viewState.nav,
        openUserProfile: store.users.openUserProfile,
        peopleDms,
        renameValue,
        renamingId,
        searchOpen,
        sectionMenuOpen,
        setAppsOpen,
        setDmsOpen,
        showAllInCategory,
        setFeedWidth,
        setNavView: store.viewState.setNavView,
        setRenameValue,
        setSearchOpen,
        setSectionMenuOpen,
        setChannelSectionSidebar: store.channels.setChannelSectionSidebar,
        setSettingsOpen,
        settingsOpen,
        setUnreadsOnly,
        setWidth,
        startRename,
        toggleCategory,
        unreadChannelIds: store.unread.unreadChannelIds,
        unreadsOnly,
        width,
      }}
    />
  );
}
