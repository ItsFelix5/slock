import { AvatarStack, Icon, Tooltip } from "@slock/ui";
import { Show } from "solid-js";
import type { Message } from "../../../lib/api";
import { formatInteractorNames } from "../../../lib/interactorNames";
import { store } from "../../../lib/store";

export default function MessageRepliesButton(props: {
  msg: Message;
  onOpenThread: (ts: string, opts?: { pinned?: boolean }) => void;
}) {
  return (
    <button
      class="message-replies btn-reset flex-align-center"
      onClick={(e) => props.onOpenThread(props.msg.ts, { pinned: e.ctrlKey || e.metaKey })}
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
              store.users.currentUser()?.id,
              store.users.userById,
            )}
          >
            <AvatarStack
              users={users()
                .map((id) => store.users.userById(id))
                .filter((u) => u !== undefined)}
              max={3}
            />
          </Tooltip>
        )}
      </Show>
      <span class="message-replies-count">
        {props.msg.replyCount} {props.msg.replyCount === 1 ? "reply" : "replies"}
      </span>
      <Show when={props.msg.lastReplyLabel}>
        <span class="message-replies-last">Last reply {props.msg.lastReplyLabel}</span>
      </Show>
    </button>
  );
}
