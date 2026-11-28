import { service } from "@slock/core/solid";
import type { PaneContent } from "@slock/plugins/shell/client/api/types";
import type { ChannelId } from "@slock/types";
import { createMemo, createStore } from "solid-js";
import type { ConversationKindResolver, ConversationOpenHook } from "./api";
import type { ChannelMessageTarget, PaneSide, View } from "./api/types";

const shell = service("shell.view");
const panes = service("shell.panes");

function asView(content: PaneContent | null | undefined): View | null {
  return content?.kind === "channel" || content?.kind === "dm" ? content : null;
}

export function createConversations(deps: {
  kinds: () => ConversationKindResolver[];
  opened: () => ConversationOpenHook[];
}) {
  const [targets, setTargets] = createStore<Record<string, ChannelMessageTarget | undefined>>({});

  function kindOf(id: ChannelId): View["kind"] {
    for (const resolve of deps.kinds()) {
      const kind = resolve(id);
      if (kind) return kind;
    }
    return "channel";
  }

  const viewFor = (id: ChannelId): View => ({ id, kind: kindOf(id) });

  const activeView = createMemo<View | null>(() => {
    const view = asView(shell.activeContent());
    return view && viewFor(view.id);
  });

  const visibleViews = () => panes.panes().flatMap(({ content }) => asView(content) ?? []);
  const mountedViews = () => panes.mountedPanes().flatMap(({ content }) => asView(content) ?? []);

  function writeTarget(paneId: string, target: ChannelMessageTarget | undefined) {
    setTargets((draft) => {
      if (target) draft[paneId] = target;
      else delete draft[paneId];
    });
  }

  function opening(id: ChannelId): View {
    const view = viewFor(id);
    for (const hook of deps.opened()) hook(view);
    return view;
  }

  function setActiveView(view: View, options?: { target?: ChannelMessageTarget }) {
    writeTarget(shell.open(opening(view.id)), options?.target);
  }

  function openAtPane(id: ChannelId, paneId: string, side: PaneSide) {
    const view = opening(id);
    if (side === "over") {
      writeTarget(paneId, undefined);
      panes.setPaneContent(paneId, view);
      panes.activatePane(paneId);
      return;
    }
    const open = panes.currentPanes();
    const index = open.findIndex((pane) => pane.id === paneId);
    panes.insertContentPane(view, side === "after" ? paneId : (open[index - 1]?.id ?? null));
  }

  return {
    activeView,
    clearMessageTarget: (paneId: string) => writeTarget(paneId, undefined),
    isOpenInAnyPane: (id: ChannelId, kind: View["kind"]) =>
      visibleViews().some((view) => view.kind === kind && view.id === id),
    kindOf,
    mountedViews,
    messageTarget: (paneId: string) => targets[paneId] ?? null,
    openAtPane,
    setActiveView,
    setMessageTarget: writeTarget,
    targetPaneIds: () => Object.keys(targets),
    viewFor,
    visibleMessageTargets: () =>
      Object.values(targets).filter((target): target is ChannelMessageTarget => !!target),
    visibleViews,
  };
}
