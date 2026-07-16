import { Mrkdwn } from "@slock/blockkit";
import { fetchPermalinkMessage } from "@slock/slack-api";
import { Avatar, FloatingPanel, useHoverIntent } from "@slock/ui";
import { createResource, type JSX, Show } from "solid-js";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";
import "./MessageLinkHoverCard.css";

const CARD_WIDTH = 320;

// A lightweight preview of the message a pasted Slack permalink points at —
// sender + snippet — fetched on demand since the target may not be part of
// any channel/thread the viewer already has loaded.
export default function MessageLinkHoverCard(props: {
  channelId: string;
  messageTs: string;
  threadTs: string;
  children: JSX.Element;
}) {
  // biome-ignore lint/suspicious/noUnassignedVariables: Solid assigns this variable through the JSX ref attribute.
  let anchorRef: HTMLSpanElement | undefined;
  const { cancelClose, open, scheduleClose, scheduleOpen } = useHoverIntent();

  const [message] = createResource(
    () => (open() ? props : undefined),
    (p) => fetchPermalinkMessage(p.channelId, p.messageTs, p.threadTs).catch(() => undefined),
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-intent wrapper; the real control is the link itself
    <span
      class="message-link-hovercard-anchor"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      ref={anchorRef}
    >
      {props.children}
      <FloatingPanel
        align="start"
        anchor={() => anchorRef}
        class="message-link-hovercard"
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        open={open()}
        placement="top"
        style={{ width: `${CARD_WIDTH}px` }}
      >
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
                <Show when={store.users.userById(msg().userId)}>
                  {(u) => <Avatar size="small" user={u()} />}
                </Show>
                <span class="message-link-hovercard-name">
                  {store.users.userById(msg().userId)?.name ?? msg().botName ?? "Unknown"}
                </span>
              </div>
              <div class="message-link-hovercard-text text-sm truncate-lines">
                <Mrkdwn text={parseReplyLink(msg().text)?.rest ?? msg().text} />
              </div>
            </>
          )}
        </Show>
      </FloatingPanel>
    </span>
  );
}
