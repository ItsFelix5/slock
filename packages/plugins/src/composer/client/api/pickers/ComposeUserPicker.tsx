import { service } from "@slock/core/solid";
import { userMatches } from "@slock/plugins/users/client/api";
import type { User, UserId } from "@slock/types";
import { Avatar } from "@slock/ui";
import ComposePicker from "../../views/popovers/ComposePicker";
import "./ComposeUserPicker.css";

const usersStore = service("users");

export default function ComposeUserPicker(props: {
  excludeUserIds?: UserId[];
  includeCurrentUser?: boolean;
  onSelect: (userId: UserId) => void;
  onClose: () => void;
}) {
  const excludedUserIds = () => {
    const excluded = new Set(props.excludeUserIds ?? []);
    const me = usersStore.currentUserId();
    if (!props.includeCurrentUser && me) excluded.add(me);
    return excluded;
  };

  const localUsers = () => {
    const me = usersStore.currentUser();
    const users = new Map(usersStore.knownUsers().map((user) => [user.id, user]));
    if (props.includeCurrentUser && me) users.set(me.id, me);
    return [...users.values()];
  };

  return (
    <ComposePicker<User>
      emptyMessage="No matches"
      excludeIds={[...excludedUserIds()]}
      localItems={localUsers}
      notFoundMessage="Couldn't load people"
      onClose={props.onClose}
      onSelect={props.onSelect}
      placeholder="Find a person…"
      matches={userMatches}
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
