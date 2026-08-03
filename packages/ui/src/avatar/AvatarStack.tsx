import { For, Show } from "solid-js";
import Avatar, { type AvatarUser } from "./Avatar";
import "./AvatarStack.css";

export interface AvatarStackProps {
  max?: number;
  size?: "small" | "medium" | "large";
  users: AvatarUser[];
}

export default function AvatarStack(props: AvatarStackProps) {
  const max = () => Math.max(1, props.max ?? Infinity);
  const hasExtraUsers = () => props.users.length > max();
  const visibleUsers = () => props.users.slice(0, hasExtraUsers() ? max() - 1 : max());
  const extraUsers = () => Math.max(0, props.users.length - visibleUsers().length);
  const size = () => props.size ?? "small";

  return (
    <span class="avatar-stack">
      <For each={visibleUsers()}>
        {(user) => (
          <span class="avatar-stack-item">
            <Avatar size={size()} user={user} />
          </span>
        )}
      </For>
      <Show when={extraUsers() > 0}>
        <span aria-hidden="true" class={`avatar-stack-item avatar-stack-overflow avatar-${size()}`}>
          +{extraUsers()}
        </span>
      </Show>
    </span>
  );
}
