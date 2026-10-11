import { service } from "@slock/core/solid";
import { Button, Icon, InlineFeedback } from "@slock/ui";
import "./JoinChannelBar.css";

const feedback = service("feedback");

const channelsStore = service("channels");
const titles = service("titles");

export default function JoinChannelBar(props: { channelId: string }) {
  const name = () => titles.title(props.channelId);

  return (
    <div class="channel-notice-bar composer-frame surface-popover flex-between">
      <div class="channel-notice-bar-text truncate">
        You aren't a member of <strong>#{name()}</strong>.
      </div>
      <InlineFeedback
        class="channel-notice-bar-feedback truncate"
        feedback={feedback.get(props.channelId)}
        priority={2}
      />
      <Button
        class="flex-shrink-0"
        disabled={channelsStore.isJoinPending(props.channelId)}
        onClick={() => channelsStore.joinChannelById(props.channelId)}
        variant="primary"
      >
        <Icon name="plus" size={14} />
        {channelsStore.isJoinPending(props.channelId) ? "Joining…" : "Join channel"}
      </Button>
    </div>
  );
}
