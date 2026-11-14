import { service } from "@slock/core/solid";
import { Avatar, AvatarStack, Button } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageHeaderProps } from "../../../messages/client/api";
import "./DmIntro.css";
import { useDmPeople } from "./useDmPeople";

const usersStore = service("users");
const titles = service("titles");

export default function DmIntro(props: MessageHeaderProps) {
  const { members, user } = useDmPeople(props);
  return (
    <div class="dm-intro flex-col">
      <Show fallback={<AvatarStack max={5} size="large" users={members()} />} when={user()}>
        {(u) => <Avatar showPresence size="large" user={u()} />}
      </Show>
      <h2 class="dm-intro-name truncate">
        {titles.title(props.id)}
        <Show when={user()?.pronouns}>
          <span class="dm-intro-pronouns text-dim">({user()?.pronouns})</span>
        </Show>
      </h2>
      <Show when={user()?.title}>
        <p class="text-muted">{user()?.title}</p>
      </Show>
      <p class="text-muted">
        This is the start of your conversation with {titles.title(props.id)}.
      </p>
      <Show when={user()}>
        {(u) => (
          <Button onClick={() => usersStore.openUserProfile(u().id)} size="sm">
            View profile
          </Button>
        )}
      </Show>
    </div>
  );
}
