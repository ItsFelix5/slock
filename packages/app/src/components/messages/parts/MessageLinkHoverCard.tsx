import { Mrkdwn } from "@slock/blockkit";
import { fetchPermalinkMessage } from "@slock/slack-api";
import { Avatar, HoverCard } from "@slock/ui";
import { createResource, createSignal, type JSX, Show } from "solid-js";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import "./MessageLinkHoverCard.css";

export default function MessageLinkHoverCard(props: {
  channelId: string;
  messageTs: string;
  threadTs: string;
  children: JSX.Element;
}) {
  const [open, setOpen] = createSignal(false);

  const [message] = createResource(
    () => (open() ? props : undefined),
    (p) => fetchPermalinkMessage(p.channelId, p.messageTs, p.threadTs).catch(() => undefined),
  );

  return (
    <HoverCard
      content={() => (
        <Show
          fallback={
            <div class="message-link-hovercard-status text-dim text-sm">
              {message.loading ? "Loading message…" : "Message unavailable"}
            </div>
          }
          when={message()}
        >
          {(msg) => (
            <>
              <div class="message-link-hovercard-head flex-align-center">
                <Avatar
                  size="small"
                  user={{
                    avatarColor: store.users.userById(msg().userId)?.avatarColor ?? "#616061",
                    avatarUrl: msg().botIcon ?? store.users.userById(msg().userId)?.avatarUrl,
                    id: msg().userId,
                    name: msg().botName ?? store.users.userById(msg().userId)?.name ?? "Unknown",
                  }}
                />
                <span class="message-link-hovercard-name">
                  {msg().botName ?? store.users.userById(msg().userId)?.name ?? "Unknown"}
                </span>
              </div>
              <div class="message-link-hovercard-text text-sm truncate-lines">
                <Mrkdwn text={parseReplyLink(msg().text)?.rest ?? msg().text} />
              </div>
            </>
          )}
        </Show>
      )}
      onOpenChange={setOpen}
      panelClass="message-link-hovercard"
      width={320}
    >
      {props.children}
    </HoverCard>
  );
}
