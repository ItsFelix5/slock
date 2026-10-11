import { service } from "@slock/core/solid";
import { batch, createMemo } from "solid-js";
import { createStore } from "solid-js/store";
import type { PaneContent } from "../../shell/client/api/types";
import type { ConversationKindResolver, ConversationOpenHook } from "./api";
import type { ChannelMessageTarget, View } from "./api/types";

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

  function kindOf(id: string): View["kind"] {
    for (const resolve of deps.kinds()) {
      const kind = resolve(id);
      if (kind) return kind;
    }
    return "channel";
  }

  const viewFor = (id: string): View => ({ id, kind: kindOf(id) });

  const activeView = createMemo<View | null>(() => {
    const view = asView(shell.activeContent());
    return view && viewFor(view.id);
  });

  const visibleViews = () => panes.panes().flatMap(({ content }) => asView(content) ?? []);

  function setActiveView(view: View, options?: { target?: ChannelMessageTarget }) {
    const next = viewFor(view.id);
    batch(() => {
      for (const hook of deps.opened()) hook(next);
      setTargets(shell.open(next), options?.target);
    });
  }

  return {
    activeView,
    clearMessageTarget: (paneId: string) => setTargets(paneId, undefined),
    isOpenInAnyPane: (id: string, kind: View["kind"]) =>
      visibleViews().some((view) => view.kind === kind && view.id === id),
    kindOf,
    messageTarget: (paneId: string) => targets[paneId] ?? null,
    setActiveView,
    setMessageTarget: (paneId: string, target: ChannelMessageTarget) => setTargets(paneId, target),
    targetPaneIds: () => Object.keys(targets),
    viewFor,
    visibleMessageTargets: () =>
      Object.values(targets).filter((target): target is ChannelMessageTarget => !!target),
    visibleViews,
  };
}
