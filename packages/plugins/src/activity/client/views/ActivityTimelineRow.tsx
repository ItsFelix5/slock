import MessageActionsMenuItems from "@slock/plugins/messages/client/api/cards/MessageActionsMenuItems";
import type { MessageAuthorFields } from "@slock/plugins/messages/client/api/messageAuthor";
import type { Attachment, Block, ChannelId, Message, SlackFile, Ts } from "@slock/types";
import { ContextMenu, useContextMenu } from "@slock/ui";
import { Show } from "solid-js";
import { ThreadMessageRow } from "./activityThreadMessage";

export default function ActivityTimelineRow(props: {
  attachments?: Attachment[];
  author: MessageAuthorFields;
  blocks?: Block[];
  channelId: ChannelId;
  files?: SlackFile[];
  isFirst: boolean;
  isLast: boolean;
  isRoot: boolean;
  message?: Message;
  onOpen: () => void;
  text: string;
  threadTs: Ts;
  ts: Ts;
  unread: boolean;
}) {
  const ctxMenu = useContextMenu();
  return (
    <>
      <ThreadMessageRow
        attachments={props.attachments}
        author={props.author}
        blocks={props.blocks}
        channelId={props.channelId}
        files={props.files}
        isFirst={props.isFirst}
        isLast={props.isLast}
        isRoot={props.isRoot}
        onContextMenu={props.message ? ctxMenu.open : undefined}
        onOpen={props.onOpen}
        text={props.text}
        threadTs={props.threadTs}
        ts={props.ts}
        unread={props.unread}
      />
      <Show when={props.message}>
        {(message) => (
          <ContextMenu
            onClose={ctxMenu.close}
            open={ctxMenu.isOpen()}
            x={ctxMenu.x()}
            y={ctxMenu.y()}
          >
            <MessageActionsMenuItems
              channelId={props.channelId}
              msg={message()}
              onClose={ctxMenu.close}
              onEditRequest={props.onOpen}
              threadTs={props.threadTs}
            />
          </ContextMenu>
        )}
      </Show>
    </>
  );
}
