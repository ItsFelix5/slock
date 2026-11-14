import { Avatar, AvatarStack } from "@slock/ui";
import { Show } from "solid-js";
import type { MessageHeaderProps } from "../../../messages/client/api";
import { useDmPeople } from "./useDmPeople";

export default function DmTitleAvatar(props: MessageHeaderProps) {
  const { members, user } = useDmPeople(props);
  return (
    <Show fallback={<AvatarStack max={3} size="small" users={members()} />} when={user()}>
      {(u) => <Avatar showPresence size="small" user={u()} />}
    </Show>
  );
}
