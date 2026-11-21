import { service } from "@slock/core/solid";
import { openGroupDm } from "@slock/plugins/slack/client/api";
import type { User, UserId } from "@slock/types";
import { Combobox, type ComboboxOption } from "@slock/ui";
import { createSignal } from "solid-js";
import CreateDialog from "./CreateDialog";

const dms = service("dms");
const conversations = service("conversations");
const users = service("users");

const MAX_PEOPLE = 8;

const toOption = (user: User): ComboboxOption<UserId> => ({
  avatar: user,
  id: user.id,
  label: user.name,
});

async function searchPeople(query: string): Promise<ComboboxOption<UserId>[]> {
  const me = users.currentUser()?.id;
  const found = query
    ? await users.searchUsers(query, me)
    : users.knownUsers().filter((user) => user.id !== me);
  return found.map(toOption);
}

export default function CreateGroupChatDialog(props: { onClose: () => void }) {
  const [people, setPeople] = createSignal<ComboboxOption<UserId>[]>([]);

  return (
    <CreateDialog
      canSubmit={people().length >= 2}
      fallbackError="Couldn't create group chat."
      onClose={props.onClose}
      onSubmit={async () => {
        const channelId = await openGroupDm(people().map((person) => person.id));
        await dms.ensureMpdm(channelId);
        conversations.setActiveView({ id: channelId, kind: "dm" });
      }}
      title="New group chat"
    >
      <div class="create-field">
        <span class="create-label">People</span>
        <Combobox
          ariaLabel="People"
          max={MAX_PEOPLE}
          multiple
          onChange={setPeople}
          placeholder="Find people"
          search={searchPeople}
          value={people()}
        />
      </div>
    </CreateDialog>
  );
}
