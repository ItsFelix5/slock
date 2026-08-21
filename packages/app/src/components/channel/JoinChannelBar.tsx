import { Button, Icon, InlineFeedback } from "@slock/ui";
import { channelDisplayName } from "../../lib/displayName";
import { actionFeedback } from "../../lib/feedback";
import { store } from "../../lib/store";
import "./JoinChannelBar.css";

export default function JoinChannelBar(props: { channelId: string }) {
  const name = () =>
    channelDisplayName(store.channels.channelById(props.channelId), props.channelId);

  return (
    <div class="channel-notice-bar flex-between">
      <div class="channel-notice-bar-text">
        You aren't a member of <strong>#{name()}</strong>.
      </div>
      <InlineFeedback
        class="channel-notice-bar-feedback"
        feedback={actionFeedback.get(props.channelId)}
        priority={2}
      />
      <Button
        class="flex-shrink-0"
        disabled={store.channels.isJoinPending(props.channelId)}
        onClick={() => store.channels.joinChannelById(props.channelId)}
        variant="primary"
      >
        <Icon name="plus" size={14} />
        {store.channels.isJoinPending(props.channelId) ? "Joining…" : "Join channel"}
      </Button>
    </div>
  );
}
