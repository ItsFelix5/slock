import { defined } from "@slock/core";
import {
  closePane as closePaneInList,
  createPaneId,
  findPane,
  findPaneByContent,
  focusedPaneId,
  focusPaneById,
  insertPane,
  isPaneRightAfter,
  type Pane,
  replacePaneContent,
  resizePanes,
} from "@slock/ui";
import { createEffect, createSignal } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import type { PaneKind } from "../api";
import type { PaneContent } from "../api/types";

function focusPaneSoon(id: string) {
  queueMicrotask(() => focusPaneById(id));
}

export function createPanesSlice(paneKinds: () => PaneKind[]) {
  const kindOf = (content: PaneContent | null | undefined) =>
    paneKinds().find((kind) => kind.kind === content?.kind);

  function isSingletonKind(content: PaneContent): boolean {
    const rule = kindOf(content)?.singleton ?? true;
    return typeof rule === "function" ? rule(content) : rule;
  }

  const [state, setState] = createStore<{ panes: Pane<PaneContent | null>[] }>({
    panes: [{ id: createPaneId(), content: null, size: 1 }],
  });

  const [activePaneId, setActivePaneId] = createSignal<string | null>(null);
  const [mountedIds, setMountedIds] = createSignal<ReadonlySet<string>>(new Set());

  function markMounted(id: string): () => void {
    setMountedIds((ids) => new Set(ids).add(id));
    return () =>
      setMountedIds((ids) => {
        const next = new Set(ids);
        next.delete(id);
        return next;
      });
  }

  createEffect(() => {
    const id = focusedPaneId();
    if (id && findPane(state.panes, id)) setActivePaneId(id);
  });

  function activateId(id: string) {
    setActivePaneId(id);
    focusPaneSoon(id);
  }

  function currentFocusedId(): string {
    const id = activePaneId() ?? focusedPaneId();
    return id && findPane(state.panes, id) ? id : defined(state.panes[0]).id;
  }

  function isPrimaryPane(pane: Pane<PaneContent | null>): boolean {
    return !!kindOf(pane.content)?.primary;
  }

  function nearestPrimaryPaneId(fromId: string): string {
    const { panes } = state;
    const fromIndex = panes.findIndex((p) => p.id === fromId);
    if (fromIndex === -1) return defined(panes[0]).id;
    for (let i = fromIndex; i >= 0; i--) {
      if (isPrimaryPane(defined(panes[i]))) return defined(panes[i]).id;
    }
    for (let i = fromIndex + 1; i < panes.length; i++) {
      if (isPrimaryPane(defined(panes[i]))) return defined(panes[i]).id;
    }
    return defined(panes[0]).id;
  }

  function focusedPrimaryContent(): PaneContent | null {
    const id = nearestPrimaryPaneId(currentFocusedId());
    return findPane(state.panes, id)?.content ?? null;
  }

  function commit(next: Pane<PaneContent | null>[]) {
    setState("panes", reconcile(next, { key: "id" }));
  }

  function navigateFocusedPane(content: PaneContent): string {
    const id = nearestPrimaryPaneId(currentFocusedId());
    commit(replacePaneContent(unwrap(state.panes), id, content));
    activateId(id);
    return id;
  }

  function setPaneContent(id: string, content: PaneContent | null) {
    if (!findPane(state.panes, id)) return;
    commit(replacePaneContent(unwrap(state.panes), id, content));
  }

  function setAllPanes(contents: PaneContent[]) {
    const next = contents.length > 0 ? contents : [null];
    commit(
      next.map((content, i) => ({
        content,
        id: state.panes[i]?.id ?? createPaneId(),
        size: 1 / next.length,
      })),
    );
  }

  function insertContentPane(content: PaneContent, afterId: string | null): string {
    const id = createPaneId();
    const fraction = kindOf(content)?.size ?? 0.32;
    commit(insertPane(unwrap(state.panes), afterId, content, id, fraction));
    activateId(id);
    return id;
  }

  function openInNewPane(content: PaneContent): string {
    const focusedId = currentFocusedId();
    const existing = isSingletonKind(content)
      ? findPaneByContent(state.panes, (c) => !!c && c.kind === content.kind && isSingletonKind(c))
      : undefined;
    if (!existing) return insertContentPane(content, focusedId);
    const staysInPlace =
      !kindOf(content)?.followsFocus ||
      existing.id === focusedId ||
      isPaneRightAfter(state.panes, focusedId, existing.id);
    if (staysInPlace) {
      commit(replacePaneContent(unwrap(state.panes), existing.id, content));
      activateId(existing.id);
      return existing.id;
    }
    const id = createPaneId();
    const withoutExisting = closePaneInList(unwrap(state.panes), existing.id);
    commit(insertPane(withoutExisting, focusedId, content, id, kindOf(content)?.size ?? 0.32));
    activateId(id);
    return id;
  }

  function closePane(id: string) {
    if (state.panes.length <= 1) return;
    const hadFocus = activePaneId() === id || focusedPaneId() === id;
    const index = state.panes.findIndex((p) => p.id === id);
    commit(closePaneInList(unwrap(state.panes), id));
    if (hadFocus) {
      const next = state.panes[Math.min(index, state.panes.length - 1)];
      if (next) activateId(next.id);
    }
  }

  function resize(sizes: number[]) {
    commit(resizePanes(unwrap(state.panes), sizes));
  }

  return {
    activatePane: activateId,
    activePaneId,
    closePane,
    currentFocusedId,
    focusedPrimaryContent,
    insertContentPane,
    markMounted,
    mountedPanes: () => state.panes.filter((pane) => mountedIds().has(pane.id)),
    navigateFocusedPane,
    openInNewPane,
    panes: () => state.panes,
    resize,
    setAllPanes,
    setPaneContent,
  };
}
