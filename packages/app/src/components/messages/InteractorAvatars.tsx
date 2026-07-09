import { Avatar } from "@slock/ui";
import { createMemo, For, Show } from "solid-js";
import { currentUser, userById } from "../../lib/store";

// Turns a list of user ids into a natural-language list ("you, Alice and Bob"),
// resolving the current user to "you" so hover tooltips read the way Slack's do.
export function formatInteractorNames(userIds: string[]): string {
  const me = currentUser();
  const names = userIds.map((id) =>
    me && id === me.id ? "you" : (userById(id)?.name ?? "someone"),
  );
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

// A compact overlapping stack of the people who interacted with a message
// (thread repliers, reactors). Hovering the stack surfaces every name.
export default function InteractorAvatars(props: { userIds: string[]; max?: number }) {
  const max = () => props.max ?? 3;
  const shown = createMemo(() => props.userIds.slice(0, max()));
  const extra = createMemo(() => props.userIds.length - shown().length);

  return (
    <span class="interactor-avatars" title={formatInteractorNames(props.userIds)}>
      <For each={shown()}>
        {(id) => {
          const user = createMemo(() => userById(id));
          return (
            <Show when={user()}>
              {(u) => (
                <span class="interactor-avatar">
                  <Avatar user={u()} size="small" />
                </span>
              )}
            </Show>
          );
        }}
      </For>
      <Show when={extra() > 0}>
        <span class="interactor-extra">+{extra()}</span>
      </Show>
    </span>
  );
}
