import { EmojiText } from "@slock/blockkit";
import { focusedPaneId, narrowPaneContent, type Pane, useEscapeClose } from "@slock/ui";
import { createEffect, type JSX, lazy, Match, Show, Switch } from "solid-js";
import { conversationDisplayName } from "../../lib/displayName";
import { store } from "../../lib/store";
import type {
  CanvasPaneContent,
  PaneContent,
  PinnedPaneContent,
  ProfilePaneContent,
  ThreadPaneContent,
  UsergroupDetailsPaneContent,
  View,
} from "../../lib/store/slices/types";
import ThreadPane from "../messages/thread/ThreadPane";
import UserProfile from "../user/UserProfile";
import ConversationPane from "./ConversationPane";

const UsergroupDetails = lazy(() => import("../usergroup/UsergroupDetails"));
const CanvasPane = lazy(() => import("../channel/CanvasPane"));
const PinnedPane = lazy(() => import("../channel/PinnedPane"));

export function paneTabLabel(pane: Pane<PaneContent | null>): JSX.Element {
  const { content } = pane;
  if (!content) return "…";
  switch (content.kind) {
    case "channel":
    case "dm":
      return conversationDisplayName(
        content.id,
        store.channels.channelById,
        store.dms.dmById,
        store.users.userById,
      );
    case "thread":
      return `Thread in ${conversationDisplayName(content.channelId, store.channels.channelById, store.dms.dmById, store.users.userById)}`;
    case "profile":
      return store.users.userById(content.userId)?.name ?? "Profile";
    case "usergroup-details":
      return store.usergroups.usergroupById(content.usergroupId)?.name ?? "Usergroup";
    case "pinned":
      return `Pinned in ${conversationDisplayName(content.channelId, store.channels.channelById, store.dms.dmById, store.users.userById)}`;
    case "canvas":
      return <EmojiText text={content.title} />;
  }
}

function hostedCanvasFileId(view: View): string | undefined {
  return view.kind === "channel" ? store.channels.channelById(view.id)?.canvasFileId : undefined;
}

function CanvasRedirect(props: { fileId: string; paneId: string }) {
  createEffect(() => {
    store.panes.setPaneContent(props.paneId, {
      fileId: props.fileId,
      kind: "canvas",
      title: store.canvas.canvasTitle(props.fileId) ?? "",
    });
  });
  return null;
}

export default function PaneSwitch(props: { pane: Pane<PaneContent | null> }) {
  useEscapeClose(
    () => store.viewState.closeTile(props.pane.id),
    () => focusedPaneId() === props.pane.id,
  );

  return (
    <Switch>
      <Match keyed when={narrowPaneContent<PaneContent, View>(props.pane, ["channel", "dm"])}>
        {(pane) => (
          <Show fallback={<ConversationPane pane={pane} />} when={hostedCanvasFileId(pane.content)}>
            {(fileId) => <CanvasRedirect fileId={fileId()} paneId={pane.id} />}
          </Show>
        )}
      </Match>
      <Match keyed when={narrowPaneContent<PaneContent, ThreadPaneContent>(props.pane, "thread")}>
        {(pane) => <ThreadPane pane={pane} />}
      </Match>
      <Match keyed when={narrowPaneContent<PaneContent, ProfilePaneContent>(props.pane, "profile")}>
        {(pane) => <UserProfile pane={pane} />}
      </Match>
      <Match
        keyed
        when={narrowPaneContent<PaneContent, UsergroupDetailsPaneContent>(
          props.pane,
          "usergroup-details",
        )}
      >
        {(pane) => <UsergroupDetails pane={pane} />}
      </Match>
      <Match keyed when={narrowPaneContent<PaneContent, PinnedPaneContent>(props.pane, "pinned")}>
        {(pane) => <PinnedPane pane={pane} />}
      </Match>
      <Match keyed when={narrowPaneContent<PaneContent, CanvasPaneContent>(props.pane, "canvas")}>
        {(pane) => <CanvasPane pane={pane} />}
      </Match>
    </Switch>
  );
}
