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
import { createEffect, createSignal, createStore, reconcile } from "solid-js";
import type { PaneKind } from "../api";
import type { PaneContent } from "../api/types";

type ShellPane = Pane<PaneContent | null>;

function focusPaneSoon(id: string) {
  queueMicrotask(() => focusPaneById(id));
}

function focusedIdIn(panes: ShellPane[], activeId: string | null): string {
  const id = activeId ?? focusedPaneId();
  return id && findPane(panes, id) ? id : defined(panes[0]).id;
}

export function createPanesSlice(paneKinds: () => PaneKind[]) {
  const kindOf = (content: PaneContent | null | undefined) =>
    paneKinds().find((kind) => kind.kind === content?.kind);

  function isSingletonKind(content: PaneContent): boolean {
    const rule = kindOf(content)?.singleton ?? true;
    return typeof rule === "function" ? rule(content) : rule;
  }

  const isPrimaryPane = (pane: ShellPane) => !!kindOf(pane.content)?.primary;

  function nearestPrimaryId(panes: ShellPane[], fromId: string): string {
    const fromIndex = panes.findIndex((p) => p.id === fromId);
    const first = defined(panes[0]).id;
    if (fromIndex === -1) return first;
    const before = panes.slice(0, fromIndex + 1).reverse();
    const after = panes.slice(fromIndex + 1);
    return [...before, ...after].find(isPrimaryPane)?.id ?? first;
  }

  function primaryContentIn(panes: ShellPane[], activeId: string | null): PaneContent | null {
    const id = nearestPrimaryId(panes, focusedIdIn(panes, activeId));
    return findPane(panes, id)?.content ?? null;
  }

  // `latest` and `active` are the synchronous truth for actions; the store and signal
  // below publish them to readers once the batch flushes.
  let latest: ShellPane[] = [{ content: null, id: createPaneId(), size: 1 }];
  let active: string | null = null;
  const [state, setState] = createStore<{ panes: ShellPane[] }>({
    panes: latest.map((pane) => ({ ...pane })),
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

  function setActive(id: string) {
    active = id;
    setActivePaneId(id);
  }

  createEffect(
    () => {
      const id = focusedPaneId();
      return id && findPane(state.panes, id) ? id : null;
    },
    (id) => {
      if (id) setActive(id);
    },
  );

  function activateId(id: string) {
    setActive(id);
    focusPaneSoon(id);
  }

  function commit(next: ShellPane[]) {
    latest = next;
    setState((draft) => {
      reconcile(next, "id")(draft.panes);
    });
  }

  function navigateFocusedPane(content: PaneContent): string {
    const id = nearestPrimaryId(latest, focusedIdIn(latest, active));
    commit(replacePaneContent(latest, id, content));
    activateId(id);
    return id;
  }

  function setPaneContent(id: string, content: PaneContent | null) {
    if (!findPane(latest, id)) return;
    commit(replacePaneContent(latest, id, content));
  }

  function setAllPanes(contents: PaneContent[]) {
    const next = contents.length > 0 ? contents : [null];
    commit(
      next.map((content, i) => ({
        content,
        id: latest[i]?.id ?? createPaneId(),
        size: 1 / next.length,
      })),
    );
  }

  function insertContentPane(content: PaneContent, afterId: string | null): string {
    const id = createPaneId();
    const fraction = kindOf(content)?.size ?? 0.32;
    commit(insertPane(latest, afterId, content, id, fraction));
    activateId(id);
    return id;
  }

  function openInNewPane(content: PaneContent): string {
    const focusedId = focusedIdIn(latest, active);
    const existing = isSingletonKind(content)
      ? findPaneByContent(latest, (c) => !!c && c.kind === content.kind && isSingletonKind(c))
      : undefined;
    if (!existing) return insertContentPane(content, focusedId);
    const staysInPlace =
      !kindOf(content)?.followsFocus ||
      existing.id === focusedId ||
      isPaneRightAfter(latest, focusedId, existing.id);
    if (staysInPlace) {
      commit(replacePaneContent(latest, existing.id, content));
      activateId(existing.id);
      return existing.id;
    }
    const id = createPaneId();
    const withoutExisting = closePaneInList(latest, existing.id);
    commit(insertPane(withoutExisting, focusedId, content, id, kindOf(content)?.size ?? 0.32));
    activateId(id);
    return id;
  }

  function closePane(id: string) {
    if (latest.length <= 1) return;
    const hadFocus = active === id || focusedPaneId() === id;
    const index = latest.findIndex((p) => p.id === id);
    const next = closePaneInList(latest, id);
    commit(next);
    const successor = next[Math.min(index, next.length - 1)];
    if (hadFocus && successor) activateId(successor.id);
  }

  function resize(sizes: number[]) {
    commit(resizePanes(latest, sizes));
  }

  return {
    activatePane: activateId,
    activePaneId,
    closePane,
    currentPanes: () => latest,
    focusedPrimaryContent: () => primaryContentIn(state.panes, activePaneId()),
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
