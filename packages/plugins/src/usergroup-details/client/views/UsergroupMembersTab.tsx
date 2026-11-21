import { service } from "@slock/core/solid";
import ComposeUserPicker from "@slock/plugins/composer/client/api/pickers/ComposeUserPicker";
import type { User, UserId } from "@slock/types";
import { AddRowButton, Avatar, Button, initRovingTabIndexDefault } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import RemoveRowButton from "./RemoveRowButton";
import "./UsergroupDetails.css";

const dialogs = service("shell.dialogs");

const details = service("usergroup-details");

const usersStore = service("users");

export default function UsergroupMembersTab(props: {
  disabled: boolean;
  usergroupId: string;
  memberIds: UserId[];
}) {
  let listRef: HTMLDivElement | undefined;
  const [query, setQuery] = createSignal("");
  const [addingPeople, setAddingPeople] = createSignal(false);

  const selfId = () => usersStore.currentUser()?.id;
  const isSelfMember = () => {
    const me = selfId();
    return !!me && props.memberIds.includes(me);
  };

  const members = createMemo(() => {
    const users = props.memberIds
      .map((id) => usersStore.userById(id))
      .filter((u): u is User => !!u);
    return [...users.filter((u) => u.id === selfId()), ...users.filter((u) => u.id !== selfId())];
  });

  const filteredMembers = createMemo(() => {
    const q = query().trim().toLowerCase();
    if (!q) return members();
    return members().filter((u) => u.name.toLowerCase().includes(q));
  });

  initRovingTabIndexDefault(() => listRef, filteredMembers);

  const addMember = async (userId: UserId) => {
    if (props.disabled) return;
    setAddingPeople(false);
    await details.addUsergroupMembers(props.usergroupId, [userId]);
  };

  const removeMember = async (user: User) => {
    if (props.disabled) return;

    const confirmed = await dialogs.confirm({
      confirmLabel: "Remove",
      danger: true,
      message: `Remove ${user.name} from this pinggroup?`,
    });
    if (!confirmed) return;
    await details.removeUsergroupMember(props.usergroupId, user.id);
  };

  return (
    <div class="usergroup-details-tab-content flex-col">
      <div class="usergroup-details-list-bar">
        <input
          class="text-field"
          disabled={props.disabled}
          onInput={(e) => setQuery(e.currentTarget.value)}
          placeholder="Find members"
          type="text"
          value={query()}
        />
        <AddRowButton
          disabled={props.disabled}
          icon="user-add"
          label="Add people"
          onClick={() => setAddingPeople(true)}
        />
      </div>
      <Show when={addingPeople()}>
        <div class="usergroup-details-picker">
          <ComposeUserPicker
            excludeUserIds={props.memberIds}
            onClose={() => setAddingPeople(false)}
            onSelect={(userId) => void addMember(userId)}
          />
        </div>
      </Show>
      <div class="flex-col" ref={listRef}>
        <Show when={!(isSelfMember() || query().trim()) && usersStore.currentUser()}>
          {(me) => (
            <div class="usergroup-details-row flex-align-center usergroup-details-row-join">
              <div class="usergroup-details-row-main flex-align-center">
                <Avatar size="small" user={me()} />
                <span class="usergroup-details-row-name truncate">{me().name}</span>
                <span class="usergroup-details-row-hint truncate meta-dim">
                  Not in this pinggroup
                </span>
              </div>
              <Button
                disabled={props.disabled}
                onClick={() => addMember(me().id)}
                size="sm"
                variant="primary"
              >
                Join
              </Button>
            </div>
          )}
        </Show>
        <For each={filteredMembers()} fallback={<p class="usergroup-details-empty">No members.</p>}>
          {(u) => (
            <div class="usergroup-details-row flex-align-center">
              <button
                class="usergroup-details-row-main btn-reset flex-align-center"
                data-nav-row
                onClick={() => usersStore.openUserProfile(u.id)}
                tabindex={-1}
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
