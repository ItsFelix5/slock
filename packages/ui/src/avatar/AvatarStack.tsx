import { For, Show } from "solid-js";
import Avatar, { type AvatarUser } from "./Avatar";
import "./AvatarStack.css";

interface AvatarStackProps {
  max?: number;
  size?: "tiny" | "small" | "medium" | "large";
  total?: number | undefined;
  users: AvatarUser[];
}

export default function AvatarStack(props: AvatarStackProps) {
  const visibleUsers = () => props.users.slice(0, props.max);
  const extraUsers = () => (props.total ?? props.users.length) - visibleUsers().length;
  const size = () => props.size ?? "small";

  return (
    <span class="avatar-stack">
      <For each={visibleUsers()} keyed={false}>
        {(user, index) => (
          <span class="avatar-stack-item">
            <Avatar size={size()} user={user()} />
            <Show when={index === visibleUsers().length - 1 && extraUsers() > 0}>
              <span aria-hidden="true" class="avatar-stack-overflow flex-center">
                +{extraUsers()}
              </span>
            </Show>
          </span>
        )}
      </For>
    </span>
  );
}
