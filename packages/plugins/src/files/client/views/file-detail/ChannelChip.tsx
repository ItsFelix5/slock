import { service } from "@slock/core/solid";
import { channelDisplayName, channelIconName } from "@slock/plugins/channels/client/api";
import {
  openConversation,
  openConversationInSplit,
} from "@slock/plugins/conversations/client/api/nav";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import type { ChannelId, SlackFileShare } from "@slock/types";
import { Icon } from "@slock/ui";

const channelsStore = service("channels");
const messageLinks = service("message-links");

export default function ChannelChip(props: {
  channelId: ChannelId;
  name?: string;
  onOpen: () => void;
  private?: boolean;
  share?: SlackFileShare;
}) {
  const channel = () => channelsStore.channelById(props.channelId);
  const open = () => {
    const { channelId, share } = props;
    props.onOpen();
    if (share) messageLinks.openChannelMessage(channelId, share.ts, share.threadTs);
    else openConversation(channelId);
  };
  const openInSplit = () => {
    const { channelId, share } = props;
    if (share) messageLinks.openMessageInSplit(channelId, share.ts, share.threadTs);
    else openConversationInSplit(channelId);
  };

  return (
    <SplitNavigation onSplit={openInSplit}>
      <button class="file-detail-channel btn-reset flex-align-center" onClick={open} type="button">
        <Icon name={channelIconName(props.private ?? channel()?.private)} size={16} />
        <span class="truncate">{props.name ?? channelDisplayName(channel(), props.channelId)}</span>
      </button>
    </SplitNavigation>
  );
}
