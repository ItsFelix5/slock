import { createMemo, For, Show } from "solid-js";
import Avatar, { type AvatarUser } from "./Avatar";
import "./AvatarStack.css";

export interface AvatarStackProps {
  users: AvatarUser[];
  max?: number;
  size?: "small" | "medium" | "large";
  title?: string;
}

// An overlapping row of avatars with a "+N" overflow badge. Generic on purpose:
// callers resolve their own domain objects down to AvatarUser first.
export default function AvatarStack(props: AvatarStackProps) {
  const max = () => props.max ?? 3;
  const shown = createMemo(() => props.users.slice(0, max()));
  const extra = createMemo(() => props.users.length - shown().length);

  return (
    <span class="avatar-stack" title={props.title}>
      <For each={shown()}>
        {(user) => (
          <span class="avatar-stack-item">
            <Avatar user={user} size={props.size ?? "small"} />
          </span>
        )}
      </For>
      <Show when={extra() > 0}>
        <span class="avatar-stack-extra">+{extra()}</span>
      </Show>
    </span>
  );
}
