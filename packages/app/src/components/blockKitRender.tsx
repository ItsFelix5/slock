import type { BlockKitResolver } from "@slock/blockkit";
import { openConversationInSplit } from "../lib/navigation/conversationNav";
import { parseSlackPermalink } from "../lib/navigation/slackPermalink";
import { store } from "../lib/store";
import ChannelHoverCard from "./channel/channel-details/ChannelHoverCard";
import MessageLinkHoverCard, {
  attachmentToHoverPreview,
  messageToHoverPreview,
} from "./messages/parts/MessageLinkHoverCard";
import { SplitNavigation } from "./navigation/SplitNavigation";
import UserHoverCard from "./user/UserHoverCard";
import UsergroupHoverCard from "./usergroup/UsergroupHoverCard";

export const blockKitRenderResolver: Pick<
  BlockKitResolver,
  "wrapChannelMention" | "wrapLink" | "wrapUserMention" | "wrapUsergroupMention"
> = {
  wrapChannelMention: (id, trigger) => (
    <SplitNavigation onSplit={() => openConversationInSplit(id)}>
      <ChannelHoverCard channelId={id}>{trigger}</ChannelHoverCard>
    </SplitNavigation>
  ),
  wrapLink: (url, trigger, attachments) => {
    const target = parseSlackPermalink(url);
    if (!target) return trigger;
    const unfurlAttachment = attachments?.find(
      (a) => a.isMessageUnfurl && a.ts === target.messageTs,
    );
    const knownPreview = unfurlAttachment
      ? attachmentToHoverPreview(unfurlAttachment)
      : (() => {
          const msg = store.messages
            .findAllMessageLocations(target.channelId, target.messageTs)[0]
            ?.list.find((m) => m.ts === target.messageTs);
          return msg ? messageToHoverPreview(msg) : undefined;
        })();
    return (
      <SplitNavigation onSplit={() => openConversationInSplit(target.channelId, target.threadTs)}>
        <MessageLinkHoverCard
          channelId={target.channelId}
          knownPreview={knownPreview}
          messageTs={target.messageTs}
          threadTs={target.threadTs}
        >
          {trigger}
        </MessageLinkHoverCard>
      </SplitNavigation>
    );
  },
  wrapUserMention: (id, trigger) => <UserHoverCard userId={id}>{trigger}</UserHoverCard>,
  wrapUsergroupMention: (id, trigger) => (
    <UsergroupHoverCard usergroupId={id}>{trigger}</UsergroupHoverCard>
  ),
};
