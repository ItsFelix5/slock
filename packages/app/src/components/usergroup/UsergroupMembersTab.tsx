import type { User } from "@slock/slack-api";
import { Avatar, confirmDialog, Icon } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { store } from "../../lib/store";
import { addUsergroupMembers, removeUsergroupMember } from "../../lib/usergroupDetails";
import ComposeUserPicker from "../composer/popovers/ComposeUserPicker";
import RemoveRowButton from "./RemoveRowButton";
import "./UsergroupDetails.css";

export default function UsergroupMembersTab(props: {
  disabled: boolean;
  usergroupId: string;
  memberIds: string[];
}) {
  const [query, setQuery] = createSignal("");
  const [addingPeople, setAddingPeople] = createSignal(false);

  const members = createMemo(() =>
    props.memberIds.map((id) => store.users.userById(id)).filter((u): u is User => !!u),
  );

  const filteredMembers = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return members();
    return members().filter((u) => u.name.toLowerCase().includes(q));
  });

  const addMember = async (userId: string) => {
    if (props.disabled) return;
    setAddingPeople(false);
    await addUsergroupMembers(props.usergroupId, [userId]);
  };

  const removeMember = async (user: User) => {
    if (props.disabled) return;

    const confirmed = await confirmDialog({
      confirmLabel: "Remove",
      danger: true,
      message: `Remove ${user.name} from this pinggroup?`,
    });
    if (!confirmed) return;
    await removeUsergroupMember(props.usergroupId, user.id);
  };

  return (
    <div class="usergroup-details-tab-content flex-col">
      <div class="usergroup-details-list-bar">
        <input
          class="usergroup-details-input"
          disabled={props.disabled}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Find members"
          type="text"
          value={query()}
        />
        <button
          class="usergroup-details-add-btn btn-reset flex-align-center"
          disabled={props.disabled}
          onClick={() => setAddingPeople(true)}
          type="button"
        >
          <Icon name="user-add" size={15} /> Add people
        </button>
      </div>
      <Show when={addingPeople()}>
        <div class="usergroup-details-picker">
          <ComposeUserPicker
            excludeUserIds={props.memberIds}
            onClose={() => setAddingPeople(false)}
            onSelect={addMember}
          />
        </div>
      </Show>
      <div class="flex-col">
        <For each={filteredMembers()} fallback={<p class="usergroup-details-empty">No members.</p>}>
          {(u) => (
            <div class="usergroup-details-row">
              <button
                class="usergroup-details-row-main btn-reset flex-align-center"
                data-nav-row
                onClick={() => store.users.openUserProfile(u.id)}
                type="button"
              >
                <Avatar size="small" user={u} />
                <span class="usergroup-details-row-name truncate">{u.name}</span>
              </button>
              <RemoveRowButton
                disabled={props.disabled}
                label="Remove from pinggroup"
                onClick={() => removeMember(u)}
              />
            </div>
          )}
        </For>
      </div>
    </div>
  );
}
