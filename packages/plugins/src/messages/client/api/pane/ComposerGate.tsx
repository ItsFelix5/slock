import { service } from "@slock/core/solid";
import { createSignal, type JSX, Match, Switch } from "solid-js";
import ChannelNoticeBar from "./ChannelNoticeBar";

const channelsStore = service("channels");
const channelDetails = service("channel-details");
const dmsStore = service("dms");

export default function ComposerGate(props: {
  channelId: string;
  children: JSX.Element;
  locked?: boolean;
}) {
  const [unarchiving, setUnarchiving] = createSignal(false);
  const archived = () => !!channelsStore.channelById(props.channelId)?.archived;
  const isMember = () =>
    !!dmsStore.dmById(props.channelId) || channelsStore.isChannelMember(props.channelId);
  const joining = () => channelsStore.isJoinPending(props.channelId);
  const unarchive = async () => {
    setUnarchiving(true);
    await channelDetails.unarchiveChannelById(props.channelId);
    setUnarchiving(false);
  };

  return (
    <Switch>
      <Match when={props.locked}>
        <ChannelNoticeBar channelId={props.channelId} subject="This thread">
          is locked.
        </ChannelNoticeBar>
      </Match>
      <Match when={archived()}>
        <ChannelNoticeBar
          action={
            isMember()
              ? {
                  disabled: unarchiving(),
                  icon: "archive",
                  label: unarchiving() ? "Unarchiving…" : "Unarchive",
                  onClick: unarchive,
                }
              : undefined
          }
          channelId={props.channelId}
        >
          is archived.
        </ChannelNoticeBar>
      </Match>
      <Match when={!isMember()}>
        <ChannelNoticeBar
          action={{
            disabled: joining(),
            icon: "plus",
            label: joining() ? "Joining…" : "Join channel",
            onClick: () => channelsStore.joinChannelById(props.channelId),
          }}
          channelId={props.channelId}
        >
          isn't joined.
        </ChannelNoticeBar>
      </Match>
      <Match when>{props.children}</Match>
    </Switch>
  );
}
