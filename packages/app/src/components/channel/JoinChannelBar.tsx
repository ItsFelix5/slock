import { Icon } from "@slock/ui";
import { channelById, channelDisplayName, joinChannelById } from "../../lib/store";
import "./JoinChannelBar.css";

export default function JoinChannelBar(props: { channelId: string }) {
  const name = () => channelDisplayName(channelById(props.channelId), props.channelId);

  return (
    <div class="join-channel-bar">
      <div class="join-channel-bar-text">
        You aren't a member of <strong>#{name()}</strong>.
      </div>
      <button
        type="button"
        class="join-channel-bar-btn"
        onClick={() => joinChannelById(props.channelId)}
      >
        <Icon name="plus" size={14} />
        Join channel
      </button>
    </div>
  );
}
