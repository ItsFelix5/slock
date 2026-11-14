import { service } from "@slock/core/solid";
import { createMemo } from "solid-js";
import type { MessageHeaderProps } from "../../../messages/client/api";

const dmsStore = service("dms");
const usersStore = service("users");

export function useDmPeople(props: MessageHeaderProps) {
  const dm = createMemo(() => (props.kind === "dm" ? dmsStore.dmById(props.id) : undefined));
  const user = createMemo(() => {
    const userId = dm()?.userId;
    return userId ? usersStore.userById(userId) : undefined;
  });
  const members = createMemo(() =>
    (dm()?.memberIds ?? []).map((id) => usersStore.userById(id)).filter((u) => u !== undefined),
  );
  return { members, user };
}
