import { Show } from "solid-js";

export function MessageDayDivider(props: { day: string; dayChanged: boolean; unread: boolean }) {
  return (
    <Show when={props.dayChanged || props.unread}>
      <div
        class={[
          "message-divider flex-align-center text-center font-bold text-xs",
          { "day-divider": props.dayChanged, "unread-divider": props.unread },
        ]}
      >
        <span>
          {props.dayChanged
            ? props.unread
              ? `${props.day} · New messages`
              : props.day
            : "New messages"}
        </span>
      </div>
    </Show>
  );
}

export function RepliesDivider(props: { count: number; day?: string }) {
  return (
    <div class="day-divider message-divider flex-align-center text-center font-bold text-xs">
      <span>
        {props.count} {props.count === 1 ? "reply" : "replies"}
        {props.day ? ` · ${props.day}` : ""}
      </span>
    </div>
  );
}
