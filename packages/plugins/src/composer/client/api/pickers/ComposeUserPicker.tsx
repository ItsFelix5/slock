import { service } from "@slock/core/solid";
import type { User } from "@slock/types";
import { Avatar } from "@slock/ui";
import ComposePicker from "../../views/popovers/ComposePicker";
import "./ComposeUserPicker.css";

const usersStore = service("users");

export default function ComposeUserPicker(props: {
  excludeUserIds?: string[];
  includeCurrentUser?: boolean;
  onSelect: (userId: string) => void;
  onClose: () => void;
}) {
  const excludedUserIds = () => new Set(props.excludeUserIds ?? []);

  const localUsers = () => {
    const me = usersStore.currentUser();
    const users = new Map(usersStore.knownUsers().map((user) => [user.id, user]));
    if (props.includeCurrentUser && me) users.set(me.id, me);
    return [...users.values()].filter(
      (user) => !excludedUserIds().has(user.id) && (props.includeCurrentUser || user.id !== me?.id),
    );
  };

  return (
    <ComposePicker<User>
      emptyMessage="No matches"
      excludeIds={props.excludeUserIds}
      localItems={localUsers}
      notFoundMessage="Couldn't load people"
      onClose={props.onClose}
      onSelect={props.onSelect}
      placeholder="Find a person…"
      remoteSearch={async (query) => {
        const me = props.includeCurrentUser ? undefined : usersStore.currentUser()?.id;
        return await usersStore.searchUsers(query, me);
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
