import type { Message, SlackFile } from "@slock/types";
import { ContextMenu, useContextMenu } from "@slock/ui";
import { Show } from "solid-js";
import MessageActionsMenuItems from "../../messages/parts/MessageActionsMenuItems";
import type { MessageAuthorFields } from "../../messages/parts/messageAuthor";
import { ThreadMessageRow } from "./activityThreadMessage";

export default function ActivityTimelineRow(props: {
  author: MessageAuthorFields;
  channelId: string;
  files?: SlackFile[];
  isFirst: boolean;
  isLast: boolean;
  isRoot: boolean;
  message?: Message;
  onOpen: () => void;
  text: string;
  threadTs: string;
  ts: string;
  unread: boolean;
}) {
  const ctxMenu = useContextMenu();
  return (
    <>
      <ThreadMessageRow
        author={props.author}
        files={props.files}
        isFirst={props.isFirst}
        isLast={props.isLast}
        isRoot={props.isRoot}
        onContextMenu={props.message ? ctxMenu.open : undefined}
        onOpen={props.onOpen}
        text={props.text}
        time={parseFloat(props.ts) * 1000}
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
