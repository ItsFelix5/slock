import {
  createTileId,
  listLeaves,
  leaf as makeLeaf,
  replaceLeafContent,
  resizeSplit as resizeSplitInTree,
  splitLeaf,
  type TileNode,
} from "@slock/ui";
import { createEffect } from "solid-js";
import { createStore, reconcile, unwrap } from "solid-js/store";
import type { ChannelMessageTarget, View } from "../types";

export function createTilingSlice(deps: {
  activeView: () => View | null;
  channelMessageTarget: () => ChannelMessageTarget | null;
  clearChannelMessageTarget: () => void;
}) {
  const rootId = createTileId();
  const [state, setState] = createStore<{ tree: TileNode<View | null> }>({
    tree: makeLeaf(deps.activeView(), rootId),
  });
  const [messageTargets, setMessageTargets] = createStore<
    Record<string, ChannelMessageTarget | undefined>
  >({});

  createEffect(() => {
    const view = deps.activeView();
    setState(
      "tree",
      reconcile(replaceLeafContent(unwrap(state.tree), rootId, view), { key: "id" }),
    );
  });

  function resizeSplit(splitId: string, sizes: number[]) {
    setState(
      "tree",
      reconcile(resizeSplitInTree(unwrap(state.tree), splitId, sizes), { key: "id" }),
    );
  }

  function openViewInSplit(view: View) {
    setState(
      "tree",
      reconcile(splitLeaf(unwrap(state.tree), rootId, "right", view), { key: "id" }),
    );
  }

  function openMessageInSplit(view: View, target: ChannelMessageTarget) {
    const previousLeafIds = new Set(listLeaves(state.tree).map((leaf) => leaf.id));
    const tree = splitLeaf(unwrap(state.tree), rootId, "right", view);
    const newLeaf = listLeaves(tree).find((leaf) => !previousLeafIds.has(leaf.id));
    if (newLeaf) setMessageTargets(newLeaf.id, target);
    setState("tree", reconcile(tree, { key: "id" }));
  }

  function messageTarget(paneId: string) {
    return paneId === rootId ? deps.channelMessageTarget() : (messageTargets[paneId] ?? null);
  }

  function clearMessageTarget(paneId: string) {
    if (paneId === rootId) {
      deps.clearChannelMessageTarget();
      return;
    }
    setMessageTargets(paneId, undefined);
  }

  function visibleViews(): View[] {
    return listLeaves(state.tree)
      .map((l) => l.content)
      .filter((content): content is View => content !== null);
  }

  return {
    clearMessageTarget,
    messageTarget,
    openMessageInSplit,
    openViewInSplit,
    resizeSplit,
    tree: () => state.tree,
    visibleViews,
  };
}
