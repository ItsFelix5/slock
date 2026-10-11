import { service } from "@slock/core/solid";
import { Avatar } from "@slock/ui";
import { Show } from "solid-js";

const usersStore = service("users");

export default function UserChip(props: { userId: string }) {
  const user = () => usersStore.userById(props.userId);
  return (
    <span class="file-detail-user flex-align-center">
      <Show when={user()}>{(known) => <Avatar size="small" user={known()} />}</Show>
      <span class="truncate">{user()?.name ?? props.userId}</span>
    </span>
  );
}
