import { Link, Mrkdwn } from "@slock/blockkit";
import { Avatar } from "@slock/ui";
import { createMemo, type JSX, Show } from "solid-js";
import { parseReplyLink } from "../../../lib/replyLink";
import { store } from "../../../lib/store";

// Rows always sit under a day divider (see ActivityView's groupedVisibleRows),
// so the date itself would be redundant here — just the clock time.
export function formatTime(time: number) {
  return new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// A pasted message permalink round-trips as a bare, un-bracketed URL in
// `text` (see replyLink.ts) — Mrkdwn only autolinks Slack's `<url|label>`
// token, so left alone this renders as plain, unclickable text.
export function ActivityMessageText(props: { text: string }) {
  const ref = createMemo(() => parseReplyLink(props.text));
  return (
    <Show fallback={<Mrkdwn text={props.text} />} when={ref()}>
      {(r) => (
        <>
          <Link label="Original message" url={r().url} />
          <Show when={r().rest.trim()}>
            <Mrkdwn text={r().rest} />
          </Show>
        </>
      )}
    </Show>
  );
}

export function ThreadMessageRow(props: {
  eventLabel?: JSX.Element;
  isRoot?: boolean;
  onOpen: () => void;
  text: string;
  time?: number;
  unread?: boolean;
  userId: string;
}) {
  const user = createMemo(() => store.users.userById(props.userId));
  return (
    <button
      class="activity-thread-message btn-reset"
      classList={{ "activity-thread-root": props.isRoot, unread: props.unread }}
      data-nav-row
      onClick={props.onOpen}
      type="button"
    >
      <span class="activity-thread-avatar">
        <Show when={user()}>
          {(person) => (
            <Avatar
              size="small"
              user={{ ...person(), avatarColor: person().avatarColor ?? "#616061" }}
            />
          )}
        </Show>
      </span>
      <span class="activity-thread-message-body">
        <span class="activity-thread-message-head flex-align-center">
          <strong>{user()?.name ?? "Someone"}</strong>
          <Show when={props.eventLabel}>
            <span class="activity-thread-event">{props.eventLabel}</span>
          </Show>
          <Show when={props.time !== undefined}>
            <span class="activity-thread-message-time">{formatTime(props.time as number)}</span>
          </Show>
        </span>
        <span class="activity-thread-message-text">
          <ActivityMessageText text={props.text} />
        </span>
      </span>
    </button>
  );
}
