import { defined } from "@slock/core";
import { service } from "@slock/core/solid";
import { type Accessor, createMemo, createSignal } from "solid-js";
import { sectionMoveTarget } from "../../../channels/client/api/sectionMutations";
import { buildCategories, type Category } from "./categories";

export function useChannelSections(unreadsOnly: Accessor<boolean>) {
  const channels = service("channels");
  const unread = service("unread");
  const panes = service("conversations");
  const prefs = service("prefs");
  const [sectionMenuOpen, setSectionMenuOpen] = createSignal<string | null>(null);
  const [renamingId, setRenamingId] = createSignal<string | null>(null);
  const [renameValue, setRenameValue] = createSignal("");
  const [draggingSectionId, setDraggingSectionId] = createSignal<string | null>(null);
  const [dropTarget, setDropTarget] = createSignal<{ id: string; before: boolean } | null>(null);
  let sectionListEl: HTMLDivElement | undefined;

  const categories = createMemo<Category[]>(() =>
    buildCategories(
      channels.channels(),
      channels.sections,
      unreadsOnly,
      unread.isChannelUnread,
      channels.isChannelStarred,
      channels.isChannelLeft,
      (id) => panes.isOpenInAnyPane(id, "channel"),
      prefs.isChannelMuted,
    ),
  );
  const channelById = createMemo(() => {
    const map = new Map<string, Category["channels"][number]>();
    for (const cat of categories()) for (const ch of cat.channels) map.set(ch.id, ch);
    return map;
  });

  const startRename = (cat: Category) => {
    setSectionMenuOpen(null);
    setRenamingId(cat.id);
    setRenameValue(cat.name);
  };
  const commitRename = async () => {
    if (channels.isSectionStructurePending()) return;
    const id = renamingId();
    const name = renameValue().trim();
    if (!(id && name)) {
      setRenamingId(null);
      return;
    }
    if (await channels.renameChannelSection(id, name)) setRenamingId(null);
  };

  const handleSectionDragStart = (e: DragEvent, id: string) => {
    if (channels.isSectionStructurePending()) {
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
    );
    if (rows.length === 0) return;
    let bestId = defined(rows[0]).dataset.sectionId ?? "";
    let bestBefore = true;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const row of rows) {
      const dist = Math.abs(e.clientY - row.getBoundingClientRect().top);
      if (dist < bestDist) {
        bestDist = dist;
        bestId = row.dataset.sectionId ?? "";
        bestBefore = true;
      }
    }
    const others = rows.filter((row) => row.dataset.sectionId !== draggedId);
    const last = others[others.length - 1];
    if (last) {
      const bottomDist = Math.abs(e.clientY - last.getBoundingClientRect().bottom);
      if (bottomDist < bestDist) {
        bestId = last.dataset.sectionId ?? "";
        bestBefore = false;
      }
    }
    setDropTarget({ before: bestBefore, id: bestId });
  };
  const handleSectionsDragLeave = (e: DragEvent) => {
    if (sectionListEl && e.relatedTarget instanceof Node && sectionListEl.contains(e.relatedTarget))
      return;
    setDropTarget(null);
  };
  const handleSectionDragEnd = () => {
    setDraggingSectionId(null);
    setDropTarget(null);
  };
  const handleSectionDrop = (e: DragEvent) => {
    e.preventDefault();
    const draggedId = draggingSectionId();
    const target = dropTarget();
    handleSectionDragEnd();
    if (!(draggedId && target) || draggedId === target.id || channels.isSectionStructurePending())
      return;
    const otherReorderableIds = categories()
      .filter((c) => c.reorderable && c.id !== draggedId)
      .map((c) => c.id);
    const targetIndex = otherReorderableIds.indexOf(target.id);
    const nextSectionId = target.before
      ? target.id
      : (otherReorderableIds[targetIndex + 1] ?? null);
    void channels.reorderChannelSection(draggedId, nextSectionId);
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
    if (target === undefined || channels.isSectionStructurePending()) return;
    setSectionMenuOpen(null);
    void channels.reorderChannelSection(id, target);
  };

  return {
    canMoveSection,
    categories,
    channelById,
    collapsed: channels.collapsedIds,
    commitRename,
    deleteChannelSection: channels.deleteChannelSection,
    draggingSectionId,
    dropTarget,
    handleSectionDragEnd,
    handleSectionDragStart,
    handleSectionDrop,
    handleSectionsDragLeave,
    handleSectionsDragOver,
    moveSection,
    renameValue,
    renamingId,
    sectionMenuOpen,
    sectionStructurePending: channels.isSectionStructurePending,
    setRenameValue,
    setRenamingId,
    setSectionListRef: (el: HTMLDivElement) => {
      sectionListEl = el;
    },
    setSectionMenuOpen,
    startRename,
    toggleCategory: (id: string) => void channels.toggleCategoryCollapsed(id),
    toggleSectionFilter: (id: string) => channels.toggleSectionFilter(id),
  };
}

export type ChannelSections = ReturnType<typeof useChannelSections>;
