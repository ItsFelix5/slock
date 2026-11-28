import { service } from "@slock/core/solid";
import type { User, UserId } from "@slock/types";
import { Combobox, type ComboboxOption } from "@slock/ui";

const MAX_OTHERS = 8;

const users = service("users");

const toOption = (user: User): ComboboxOption<UserId> => ({
  avatar: user,
  id: user.id,
  label: user.name,
});

export function groupChatSlots(memberIds: UserId[]): number {
  return Math.max(0, MAX_OTHERS - memberIds.length);
}

export default function GroupPeoplePicker(props: {
  exclude?: UserId[];
  onChange: (people: ComboboxOption<UserId>[]) => void;
  value: ComboboxOption<UserId>[];
}) {
  async function search(query: string): Promise<ComboboxOption<UserId>[]> {
    const me = users.currentUserId();
    const excluded = new Set(props.exclude);
    const found = query
      ? await users.searchUsers(query, me)
      : users.knownUsers().filter((user) => user.id !== me);
    return found.filter((user) => !excluded.has(user.id)).map(toOption);
  }

  return (
    <Combobox
      ariaLabel="People"
      max={groupChatSlots(props.exclude ?? [])}
      multiple
      onChange={props.onChange}
      placeholder="Find people"
      search={search}
      value={props.value}
    />
  );
}
