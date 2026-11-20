import { Icon, Menu, MenuItem } from "@slock/ui";
import { createSignal, Match, Switch } from "solid-js";
import CreateChannelDialog from "./CreateChannelDialog";
import CreateGroupChatDialog from "./CreateGroupChatDialog";
import CreateUsergroupDialog from "./CreateUsergroupDialog";

type Kind = "channel" | "groupchat" | "usergroup";

export default function AddRow() {
  const [open, setOpen] = createSignal(false);
  const [kind, setKind] = createSignal<Kind>();
  const pick = (next: Kind) => {
    setOpen(false);
    setKind(next);
  };
  const close = () => setKind(undefined);

  return (
    <>
      <Menu
        onClose={() => setOpen(false)}
        open={open()}
        panelClass="menu-panel"
        placement="top"
        trigger={
          <button
            class="sidebar-row btn-reset flex-align-center"
            data-nav-row
            onClick={() => setOpen(!open())}
            tabindex={-1}
            type="button"
          >
            <span class="sidebar-row-icon">
              <Icon name="plus" size={13} />
            </span>
            <span class="sidebar-row-name truncate">Add</span>
          </button>
        }
      >
        <MenuItem icon="channel-add" onClick={() => pick("channel")}>
          New channel
        </MenuItem>
        <MenuItem icon="user-add" onClick={() => pick("groupchat")}>
          New group chat
        </MenuItem>
        <MenuItem icon="user-groups" onClick={() => pick("usergroup")}>
          New pinggroup
        </MenuItem>
      </Menu>
      <Switch>
        <Match when={kind() === "channel"}>
          <CreateChannelDialog onClose={close} />
        </Match>
        <Match when={kind() === "groupchat"}>
          <CreateGroupChatDialog onClose={close} />
        </Match>
        <Match when={kind() === "usergroup"}>
          <CreateUsergroupDialog onClose={close} />
        </Match>
      </Switch>
    </>
  );
}
