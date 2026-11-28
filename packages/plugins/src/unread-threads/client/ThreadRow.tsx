import { splitReplyLink } from "@slock/plugins/message-links/client/api/replyLink";
import MessagePreviewText from "@slock/plugins/messages/client/api/preview/MessagePreviewText";
import { SplitNavigation } from "@slock/plugins/shell/client/api/SplitNavigation";
import type { ActivityItem } from "@slock/types";
import { openUnreadThread } from "./threadTarget";
import "./ThreadRow.css";

export default function ThreadRow(props: { item: ActivityItem }) {
  return (
    <SplitNavigation onSplit={() => openUnreadThread(props.item, true)}>
      <button
        class="sidebar-row sidebar-row-thread unread btn-reset flex-align-center"
        data-nav-row
        onClick={() => openUnreadThread(props.item, false)}
        tabindex={-1}
        type="button"
      >
        <span class="sidebar-row-name truncate">
          <MessagePreviewText
            attachments={props.item.attachments}
            blocks={splitReplyLink(props.item).blocks}
            files={props.item.files}
            inline
            text={splitReplyLink(props.item).text}
          />
        </span>
      </button>
    </SplitNavigation>
  );
}
