import { For } from "solid-js";
import Avatar, { type AvatarUser } from "./Avatar";
import "./AvatarStack.css";

export interface AvatarStackProps {
  size?: "small" | "medium" | "large";
  users: AvatarUser[];
}

export default function AvatarStack(props: AvatarStackProps) {
  return (
    <span class="avatar-stack">
      <For each={props.users}>
        {(user) => (
          <span class="avatar-stack-item">
            <Avatar size={props.size ?? "small"} user={user} />
          </span>
        )}
      </For>
    </span>
  );
}
