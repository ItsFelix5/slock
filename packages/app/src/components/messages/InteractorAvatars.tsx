import { AvatarStack } from "@slock/ui";
import { createMemo } from "solid-js";
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
  const users = createMemo(() =>
    props.userIds.map((id) => userById(id)).filter((u) => u !== undefined),
  );

  return (
    <AvatarStack users={users()} max={props.max} title={formatInteractorNames(props.userIds)} />
  );
}
