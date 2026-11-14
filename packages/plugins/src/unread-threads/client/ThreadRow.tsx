import { Mrkdwn } from "@slock/blockkit";
import { service } from "@slock/core/solid";
import type { ActivityItem } from "@slock/types";
import { splitReplyLink } from "../../message-links/client/api/replyLink";
import { SplitNavigation } from "../../shell/client/api/SplitNavigation";
import "./ThreadRow.css";

const messageLinks = service("message-links");

export default function ThreadRow(props: { item: ActivityItem }) {
  const threadTs = () => props.item.threadTs ?? props.item.ts;
  return (
    <SplitNavigation
      onSplit={() =>
        messageLinks.openThread(props.item.channelId, threadTs(), props.item.ts, { pinned: true })
      }
    >
      <button
        class="sidebar-row sidebar-row-thread unread btn-reset flex-align-center"
        data-nav-row
        onClick={() =>
          messageLinks.openChannelPeek(props.item.channelId, threadTs(), props.item.ts)
        }
        tabIndex={-1}
        type="button"
      >
        <span class="sidebar-row-name truncate">
          <Mrkdwn inline text={splitReplyLink(props.item).text} />
        </span>
      </button>
    </SplitNavigation>
  );
}
