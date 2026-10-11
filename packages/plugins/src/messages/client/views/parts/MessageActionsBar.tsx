import { Slot } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { IconButton, Menu } from "@slock/ui";
import MessageActionsMenuItems from "../../api/cards/MessageActionsMenuItems";
import type { OpenThreadHandler } from "../../api/messageFocus";

export default function MessageActionsBar(props: {
  channelId: string;
  msg: Message;
  threadTs?: string;
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;
  onEditRequest: () => void;

  rowFocused: () => boolean;
  reactionPickerTs: () => string | null;
  onToggleReactionPicker: (ts: string) => void;
  moreMenuTs: () => string | null;
  onToggleMoreMenu: (ts: string) => void;
}) {
  const pickerOpen = () => props.reactionPickerTs() === props.msg.ts;
  const moreOpen = () => props.moreMenuTs() === props.msg.ts;
  const toggleMore = () => props.onToggleMoreMenu(props.msg.ts);

  return (
    <div class="message-hover-actions" classList={{ "force-visible": pickerOpen() || moreOpen() }}>
      <Slot
        channelId={props.channelId}
        msg={props.msg}
        onEditRequest={props.onEditRequest}
        onOpenThread={props.onOpenThread}
        onReplyLink={props.onReplyLink}
        onToggleReactionPicker={props.onToggleReactionPicker}
        point="messages.bar"
        reactionPickerTs={props.reactionPickerTs}
        rowFocused={props.rowFocused}
        threadTs={props.threadTs}
      />
      <Menu
        align="end"
        class="message-hover-picker-wrap"
        onClose={toggleMore}
        open={moreOpen()}
        panelClass="menu-panel message-more-menu"
        trigger={
          <IconButton
            class="message-hover-btn icon-shift busy hover-hl"
            icon="ellipsis-vertical-filled"
            label="More actions"
            onClick={toggleMore}
            tabIndex={props.rowFocused() ? undefined : -1}
          />
        }
      >
        <MessageActionsMenuItems
          channelId={props.channelId}
          msg={props.msg}
          onClose={toggleMore}
          onEditRequest={props.onEditRequest}
          threadTs={props.threadTs}
        />
      </Menu>
    </div>
  );
}
