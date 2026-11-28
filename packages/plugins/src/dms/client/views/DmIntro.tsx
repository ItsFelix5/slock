import { service } from "@slock/core/solid";
import type { MessageHeaderProps } from "@slock/plugins/messages/client/api";
import { Avatar, AvatarStack, ClickableInline } from "@slock/ui";
import { Show } from "solid-js";
import "./DmIntro.css";
import { useDmPeople } from "./useDmPeople";

const usersStore = service("users");
const titles = service("titles");

export default function DmIntro(props: MessageHeaderProps) {
  const { members, user } = useDmPeople(props);
  return (
    <div class="dm-intro flex-col">
      <Show fallback={<AvatarStack max={5} size="large" users={members()} />} when={user()}>
        {(u) => (
          <ClickableInline
            class="dm-intro-avatar flex-center"
            onActivate={() => usersStore.openUserProfile(u().id)}
          >
            <Avatar showPresence size="large" user={u()} />
          </ClickableInline>
        )}
      </Show>
      <h2 class="dm-intro-name">
        <Show fallback={titles.title(props.id)} when={user()}>
          {(u) => (
            <ClickableInline onActivate={() => usersStore.openUserProfile(u().id)}>
              {titles.title(props.id)}
            </ClickableInline>
          )}
        </Show>
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
    </div>
  );
}
