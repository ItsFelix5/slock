import { EmojiText } from "@slock/blockkit";
import { focusedPaneId, narrowPaneContent, type Pane, useEscapeClose } from "@slock/ui";
import { type JSX, lazy, Match, Switch } from "solid-js";
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
import ThreadPanel from "../messages/thread/ThreadPanel";
import UserProfile from "../user/UserProfile";
import UsergroupDetails from "../usergroup/UsergroupDetails";
import MainPane from "./MainPane";

const CanvasPanel = lazy(() => import("../channel/CanvasPanel"));
const PinnedPanel = lazy(() => import("../channel/PinnedPanel"));

export function paneTabLabel(pane: Pane<PaneContent | null>): JSX.Element {
  const content = pane.content;
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

function asViewPane(pane: Pane<PaneContent | null>): Pane<View | null> {
  const generic: any = pane;
  return generic;
}

export default function PaneSwitch(props: { pane: Pane<PaneContent | null> }) {
  useEscapeClose(
    () => store.viewState.closeTile(props.pane.id),
    () => focusedPaneId() === props.pane.id,
  );

  return (
    <Switch fallback={<MainPane pane={asViewPane(props.pane)} />}>
      <Match keyed when={narrowPaneContent<PaneContent, ThreadPaneContent>(props.pane, "thread")}>
        {(pane) => <ThreadPanel pane={pane} />}
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
        {(pane) => <PinnedPanel pane={pane} />}
      </Match>
      <Match keyed when={narrowPaneContent<PaneContent, CanvasPaneContent>(props.pane, "canvas")}>
        {(pane) => <CanvasPanel pane={pane} />}
      </Match>
    </Switch>
  );
}
