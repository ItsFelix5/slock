import { Show } from "solid-js";
import type { AvatarUser } from "../avatar/Avatar";
import AvatarStack from "../avatar/AvatarStack";
import "./TypingIndicator.css";

interface TypingIndicatorProps {
  avatars?: boolean;
  dotsOnly?: boolean;
  inline?: boolean;
  users: AvatarUser[];
}

function label(names: string[]): string {
  if (names.length === 1) return `${names[0]} is typing…`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
  if (names.length === 3) return `${names[0]}, ${names[1]}, and ${names[2]} are typing…`;
  return `${names[0]}, ${names[1]}, and ${names.length - 2} others are typing…`;
}

export default function TypingIndicator(props: TypingIndicatorProps) {
  return (
    <Show when={props.users.length > 0}>
      <span
        aria-live="polite"
        class={[
          "typing-indicator flex-align-center",
          {
            "typing-indicator-dots-only": props.dotsOnly,
            "typing-indicator-floating": !props.inline,
            "typing-indicator-inline": props.inline,
          },
        ]}
      >
        <Show when={props.avatars}>
          <AvatarStack max={3} size="tiny" users={props.users} />
        </Show>
        <span aria-hidden="true" class="typing-indicator-dots">
          <span />
          <span />
          <span />
        </span>
        <Show when={!props.dotsOnly}>
          <span class="typing-indicator-label truncate">
            {label(props.users.map((user) => user.name))}
          </span>
        </Show>
      </span>
    </Show>
  );
}
