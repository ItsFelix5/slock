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
import type {
  ChannelMessageTarget,
  PaneContent,
  ThreadPaneContent,
  ThreadRef,
  View,
} from "../types";

function focusPaneSoon(id: string) {
  queueMicrotask(() => focusPaneById(id));
}

function isSingletonKind(content: PaneContent): boolean {
  return (
    content.kind !== "channel" &&
    content.kind !== "dm" &&
    !(content.kind === "thread" && content.pinned)
  );
}

export function createPanesSlice() {
  const [state, setState] = createStore<{ panes: Pane<PaneContent | null>[] }>({
    panes: [{ id: createPaneId(), content: null, size: 1 }],
  });
  const [messageTargets, setMessageTargets] = createStore<
    Record<string, ChannelMessageTarget | undefined>
  >({});

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
    return id && findPane(state.panes, id) ? id : state.panes[0].id;
  }

  function isConversationPane(pane: Pane<PaneContent | null>): boolean {
    return pane.content?.kind === "channel" || pane.content?.kind === "dm";
  }

  function nearestConversationPaneId(fromId: string): string {
    const panes = state.panes;
    const fromIndex = panes.findIndex((p) => p.id === fromId);
    if (fromIndex === -1) return panes[0].id;
    for (let i = fromIndex; i >= 0; i--) {
      if (isConversationPane(panes[i])) return panes[i].id;
    }
    for (let i = fromIndex + 1; i < panes.length; i++) {
      if (isConversationPane(panes[i])) return panes[i].id;
    }
    return panes[0].id;
  }

  function focusedConversationContent(): PaneContent | null {
    const id = nearestConversationPaneId(currentFocusedId());
    return findPane(state.panes, id)?.content ?? null;
  }

  function navigateFocusedPane(content: View, target?: ChannelMessageTarget) {
    const id = nearestConversationPaneId(currentFocusedId());
    setState(
      "panes",
      reconcile(replacePaneContent(unwrap(state.panes), id, content), { key: "id" }),
    );
    setMessageTargets(id, target);
    activateId(id);
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
    const fraction = content.kind === "channel" || content.kind === "dm" ? 0.5 : 0.32;
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
        (c) => !!c && c.kind === content.kind && !(c.kind === "thread" && c.pinned),
      );
      if (
        existing &&
        (content.kind !== "thread" || isPaneRightAfter(state.panes, focusedId, existing.id))
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
    setMessageTargets(id, undefined);
    if (hadFocus) {
      const next = state.panes[Math.min(index, state.panes.length - 1)];
      if (next) activateId(next.id);
    }
  }

  function closeUnpinnedThread() {
    const thread = findPaneByContent(state.panes, (c) => !!c && c.kind === "thread" && !c.pinned);
    if (thread) closePane(thread.id);
  }

  function resize(sizes: number[]) {
    setState("panes", reconcile(resizePanes(unwrap(state.panes), sizes), { key: "id" }));
  }

  function messageTarget(paneId: string): ChannelMessageTarget | null {
    return messageTargets[paneId] ?? null;
  }

  function setMessageTarget(paneId: string, target: ChannelMessageTarget) {
    setMessageTargets(paneId, target);
  }

  function clearMessageTarget(paneId: string) {
    setMessageTargets(paneId, undefined);
  }

  function visibleMessageTargets(): ChannelMessageTarget[] {
    return Object.values(messageTargets).filter((t): t is ChannelMessageTarget => !!t);
  }

  function visibleViews(): View[] {
    return state.panes
      .map((p) => p.content)
      .filter((c): c is View => c?.kind === "channel" || c?.kind === "dm");
  }

  function isOpenInAnyPane(id: string, kind: "channel" | "dm"): boolean {
    return visibleViews().some((v) => v.kind === kind && v.id === id);
  }

  function visibleThreads(): ThreadRef[] {
    return state.panes
      .map((p) => p.content)
      .filter((c): c is ThreadPaneContent => c?.kind === "thread")
      .map(({ channelId, ts, highlightTs }) => ({ channelId, ts, highlightTs }));
  }

  return {
    activatePane: activateId,
    activePaneId,
    clearMessageTarget,
    closePane,
    closeUnpinnedThread,
    currentFocusedId,
    focusedConversationContent,
    insertContentPane,
    isOpenInAnyPane,
    messageTarget,
    navigateFocusedPane,
    openInNewPane,
    panes: () => state.panes,
    resize,
    setAllPanes,
    setMessageTarget,
    setPaneContent,
    visibleMessageTargets,
    visibleThreads,
    visibleViews,
  };
}
