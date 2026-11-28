import { service } from "@slock/core/solid";
import GroupPeoplePicker from "@slock/plugins/dms/client/api/GroupPeoplePicker";
import type { UserId } from "@slock/types";
import type { ComboboxOption } from "@slock/ui";
import { createSignal } from "solid-js";
import { openGroupDm } from "../requests";
import CreateDialog from "./CreateDialog";

const dms = service("dms");
const conversations = service("conversations");

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
        <GroupPeoplePicker onChange={setPeople} value={people()} />
      </div>
    </CreateDialog>
  );
}
