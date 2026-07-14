import { createMemo, For } from "solid-js";
import Avatar, { type AvatarUser } from "./Avatar";
import "./AvatarStack.css";

export interface AvatarStackProps {
  max?: number;
  size?: "small" | "medium" | "large";
  title?: () => string;
  users: AvatarUser[];
}

export default function AvatarStack(props: AvatarStackProps) {
  const max = () => props.max ?? 3;
  const shown = createMemo(() => props.users.slice(0, max()));

  return (
    <span class="avatar-stack">
      <For each={shown()}>
        {(user) => (
          <span class="avatar-stack-item">
            <Avatar size={props.size ?? "small"} user={user} />
          </span>
        )}
      </For>
      <span class="reaction-tooltip">{props.title?.()}</span>
    </span>
  );
}
