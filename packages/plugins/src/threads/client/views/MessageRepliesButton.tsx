import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { AvatarStack, Icon, Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import type { OpenThreadHandler } from "../../../messages/client/api/messageFocus";
import { formatInteractorNames } from "../../../users/client/api";

const usersStore = service("users");

export default function MessageRepliesButton(props: {
  msg: Message;
  onOpenThread: OpenThreadHandler;
}) {
  return (
    <button
      class="message-replies btn-reset flex-align-center icon-shift"
      onClick={(e) => props.onOpenThread(props.msg.ts, { pinned: e.shiftKey })}
      type="button"
    >
      <Show
        fallback={<Icon name="threads" size={14} />}
        when={props.msg.replyUsers?.length ? props.msg.replyUsers : undefined}
      >
        {(users) => (
          <Tooltip
            content={formatInteractorNames(
              users(),
              usersStore.currentUser()?.id,
              usersStore.userById,
            )}
          >
            <AvatarStack
              users={users()
                .map((id) => usersStore.userById(id))
                .filter((u) => u !== undefined)}
              max={5}
            />
          </Tooltip>
        )}
      </Show>
      <Show when={props.msg.hasUnreadReplies}>
        <span class="message-replies-unread" />
      </Show>
      <span class="message-replies-count">
        {props.msg.replyCount} {props.msg.replyCount === 1 ? "reply" : "replies"}
      </span>
      <Show when={props.msg.lastReplyLabel}>
        <span class="message-replies-last truncate">Last reply {props.msg.lastReplyLabel}</span>
      </Show>
    </button>
  );
}
