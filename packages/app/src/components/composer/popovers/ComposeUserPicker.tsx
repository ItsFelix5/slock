import type { User } from "@slock/slack-api";
import { Avatar } from "@slock/ui";
import { createMemo } from "solid-js";
import { store } from "../../../lib/store";
import ComposePicker from "./ComposePicker";
import "./ComposeUserPicker.css";

export default function ComposeUserPicker(props: {
  excludeUserIds?: string[];
  includeCurrentUser?: boolean;
  onSelect: (userId: string) => void;
  onClose: () => void;
}) {
  const excludedUserIds = createMemo(() => new Set(props.excludeUserIds ?? []));

  const localUsers = createMemo(() => {
    const me = store.users.currentUser();
    const users = new Map(store.users.knownUsers().map((user) => [user.id, user]));
    if (props.includeCurrentUser && me) users.set(me.id, me);
    return [...users.values()].filter(
      (user) => !excludedUserIds().has(user.id) && (props.includeCurrentUser || user.id !== me?.id),
    );
  });

  return (
    <ComposePicker<User>
      ariaLabel="Find a person"
      emptyMessage="No matches"
      excludeIds={props.excludeUserIds}
      localItems={localUsers}
      notFoundMessage="Couldn’t load people"
      onClose={props.onClose}
      onSelect={props.onSelect}
      placeholder="Find a person…"
      remoteSearch={async (query) => {
        const me = props.includeCurrentUser ? undefined : store.users.currentUser()?.id;
        return await store.users.searchUsers(query, me);
      }}
      renderItem={(user) => (
        <>
          <Avatar size="small" user={user} />
          {user.name}
        </>
      )}
      searchingMessage="Searching…"
    />
  );
}
