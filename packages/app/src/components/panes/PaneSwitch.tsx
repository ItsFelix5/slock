import { focusedPaneId, type Pane, useEscapeClose } from "@slock/ui";
import { Match, Switch } from "solid-js";
import { closeTile } from "../../lib/paneActions";
import type {
  ChannelDetailsPaneContent,
  PaneContent,
  PinnedPaneContent,
  ProfilePaneContent,
  ThreadPaneContent,
  UsergroupDetailsPaneContent,
  View,
} from "../../lib/store/slices/types";
import ChannelDetails from "../channel/channel-details/ChannelDetails";
import PinnedPanel from "../channel/PinnedPanel";
import ThreadPanel from "../messages/thread/ThreadPanel";
import UserProfile from "../user/UserProfile";
import UsergroupDetails from "../usergroup/UsergroupDetails";
import MainPane from "./MainPane";

export default function PaneSwitch(props: { pane: Pane<PaneContent | null> }) {
  useEscapeClose(
    () => closeTile(props.pane.id),
    () => focusedPaneId() === props.pane.id,
  );

  return (
    <Switch fallback={<MainPane pane={props.pane as Pane<View | null>} />}>
      <Match when={props.pane.content?.kind === "thread"}>
        <ThreadPanel pane={props.pane as Pane<ThreadPaneContent>} />
      </Match>
      <Match when={props.pane.content?.kind === "profile"}>
        <UserProfile pane={props.pane as Pane<ProfilePaneContent>} />
      </Match>
      <Match when={props.pane.content?.kind === "channel-details"}>
        <ChannelDetails pane={props.pane as Pane<ChannelDetailsPaneContent>} />
      </Match>
      <Match when={props.pane.content?.kind === "usergroup-details"}>
        <UsergroupDetails pane={props.pane as Pane<UsergroupDetailsPaneContent>} />
      </Match>
      <Match when={props.pane.content?.kind === "pinned"}>
        <PinnedPanel pane={props.pane as Pane<PinnedPaneContent>} />
      </Match>
    </Switch>
  );
}
