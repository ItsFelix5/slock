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

  function navigateFocusedPane(content: PaneContent): string {
    const id = nearestPrimaryPaneId(currentFocusedId());
    setState(
      "panes",
      reconcile(replacePaneContent(unwrap(state.panes), id, content), { key: "id" }),
    );
    activateId(id);
    return id;
  }

  function setPaneContent(id: string, content: PaneContent | null) {
    if (!findPane(state.panes, id)) return;
    setState(
      "panes",
      reconcile(replacePaneContent(unwrap(state.panes), id, content), { key: "id" }),
    );
  }

  function setAllPanes(contents: PaneContent[]) {
    const next = contents.length > 0 ? contents : [null];
    setState(
      "panes",
      reconcile(
        next.map((content, i) => ({
          content,
          id: state.panes[i]?.id ?? createPaneId(),
          size: 1 / next.length,
        })),
        { key: "id" },
      ),
    );
  }

  function insertContentPane(content: PaneContent, afterId: string | null): string {
    const id = createPaneId();
    const fraction = kindOf(content)?.size ?? 0.32;
    setState(
      "panes",
      reconcile(insertPane(unwrap(state.panes), afterId, content, id, fraction), { key: "id" }),
    );
    activateId(id);
    return id;
  }

  function openInNewPane(content: PaneContent): string {
    const focusedId = currentFocusedId();
    if (isSingletonKind(content)) {
      const existing = findPaneByContent(
        state.panes,
        (c) => !!c && c.kind === content.kind && isSingletonKind(c),
      );
      if (
        existing &&
        (!kindOf(content)?.followsFocus || isPaneRightAfter(state.panes, focusedId, existing.id))
      ) {
        setState(
          "panes",
          reconcile(replacePaneContent(unwrap(state.panes), existing.id, content), { key: "id" }),
        );
        activateId(existing.id);
        return existing.id;
      }
      if (existing) {
        const id = createPaneId();
        setState(
          "panes",
          reconcile(
            insertPane(
              closePaneInList(unwrap(state.panes), existing.id),
              focusedId,
              content,
              id,
              0.32,
            ),
            { key: "id" },
          ),
        );
        activateId(id);
        return id;
      }
    }
    return insertContentPane(content, focusedId);
  }

  function closePane(id: string) {
    if (state.panes.length <= 1) return;
    const hadFocus = activePaneId() === id || focusedPaneId() === id;
    const index = state.panes.findIndex((p) => p.id === id);
    setState("panes", reconcile(closePaneInList(unwrap(state.panes), id), { key: "id" }));
    if (hadFocus) {
      const next = state.panes[Math.min(index, state.panes.length - 1)];
      if (next) activateId(next.id);
    }
  }

  function resize(sizes: number[]) {
    setState("panes", reconcile(resizePanes(unwrap(state.panes), sizes), { key: "id" }));
  }

  return {
    activatePane: activateId,
    activePaneId,
    closePane,
    currentFocusedId,
    focusedPrimaryContent,
    insertContentPane,
    navigateFocusedPane,
    openInNewPane,
    panes: () => state.panes,
    resize,
    setAllPanes,
    setPaneContent,
  };
}
