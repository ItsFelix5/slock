import { service } from "@slock/core/solid";
import { createSignal, type JSX, Show } from "solid-js";
import ChannelNoticeBar from "./ChannelNoticeBar";

const channelsStore = service("channels");
const channelDetails = service("channel-details");
const dmsStore = service("dms");

export default function ComposerGate(props: { channelId: string; children: JSX.Element }) {
  const [unarchiving, setUnarchiving] = createSignal(false);
  const archived = () => !!channelsStore.channelById(props.channelId)?.archived;
  const isMember = () =>
    !!dmsStore.dmById(props.channelId) || channelsStore.isChannelMember(props.channelId);
  const unarchive = async () => {
    setUnarchiving(true);
    await channelDetails.unarchiveChannelById(props.channelId);
    setUnarchiving(false);
  };

  return (
    <Show
      fallback={
        <Show
          fallback={
            <ChannelNoticeBar
              action={{
                disabled: channelsStore.isJoinPending(props.channelId),
                icon: "plus",
                label: channelsStore.isJoinPending(props.channelId) ? "Joining…" : "Join channel",
                onClick: () => channelsStore.joinChannelById(props.channelId),
              }}
              channelId={props.channelId}
            >
              isn't joined.
            </ChannelNoticeBar>
          }
          when={isMember()}
        >
          {props.children}
        </Show>
      }
      when={archived()}
    >
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
    </Show>
  );
}
