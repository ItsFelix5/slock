import { Icon, InlineFeedback } from "@slock/ui";
import { store, actionFeedback, channelDisplayName } from "../../lib/store";
import "./JoinChannelBar.css";

export default function JoinChannelBar(props: { channelId: string }) {
  const name = () =>
    channelDisplayName(store.channels.channelById(props.channelId), props.channelId);

  return (
    <div class="join-channel-bar flex-between">
      <div class="join-channel-bar-text">
        You aren't a member of <strong>#{name()}</strong>.
      </div>
      <InlineFeedback feedback={actionFeedback.get(props.channelId)} />
      <button
        class="join-channel-bar-btn btn-reset flex-align-center"
        onClick={() => store.channels.joinChannelById(props.channelId)}
        type="button"
      >
        <Icon name="plus" size={14} />
        Join channel
      </button>
    </div>
  );
}
