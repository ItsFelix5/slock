import type { Message, MessageShortcut } from "@slock/slack-api";
import { fuzzySearch, Icon, Menu, MenuItem } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { threadContainsMessage } from "../../../lib/replyLink";
import { REMINDER_OPTIONS, store } from "../../../lib/store";
import { confirmAndDeleteMessage, copyMessageText } from "../messageActions";

export interface MessageActionsMenuItemsProps {
  channelId: string;
  msg: Message;
  onClose: () => void;
  onEditRequest: () => void;
  threadTs?: string;
}

// The message "..." menu's contents — shared between the hover toolbar's more-actions
// Menu and a message row's right-click ContextMenu, so both stay in sync for free.
export default function MessageActionsMenuItems(props: MessageActionsMenuItemsProps) {
  const [remindOpen, setRemindOpen] = createSignal(false);
  const [shortcutsOpen, setShortcutsOpen] = createSignal(false);
  const [shortcutQuery, setShortcutQuery] = createSignal("");

  const filteredShortcuts = createMemo(() => {
    const all: MessageShortcut[] = store.resources.messageShortcuts() ?? [];
    const q = shortcutQuery().trim();
    if (!q) return all;
    return fuzzySearch(all, { query: q, text: (s) => `${s.appName} ${s.name}` });
  });

  const toggleShortcuts = () => {
    if (shortcutsOpen()) setShortcutQuery("");
    setShortcutsOpen(!shortcutsOpen());
  };

  const isMine = createMemo(() => store.users.currentUser()?.id === props.msg.userId);
  const isPinned = createMemo(() => store.pinned.isMessagePinned(props.channelId, props.msg.ts));
  const canBroadcast = createMemo(
    () => !!props.threadTs && props.threadTs !== props.msg.ts && !props.msg.isBroadcast,
  );

  const close = () => {
    setRemindOpen(false);
    setShortcutsOpen(false);
    setShortcutQuery("");
    props.onClose();
  };

  const copyLink = () => {
    close();
    store.messages.copyMessageLink(props.channelId, props.msg.ts);
  };

  const togglePin = () => {
    close();
    store.pinned.togglePinMessage(props.channelId, props.msg.ts);
  };

  const broadcastToChannel = () => {
    close();
    store.messages.broadcastThreadReply(props.channelId, props.msg.ts);
  };

  const markUnread = () => {
    close();
    store.messages.markMessageUnread(props.channelId, props.msg.ts);
  };

  const copyText = () => {
    close();
    void copyMessageText(props.msg, (channelId, ts) =>
      threadContainsMessage(
        props.channelId,
        props.threadTs,
        store.messages.threadMessages[props.threadTs ?? ""] ?? [],
        channelId,
        ts,
      ),
    );
  };

  const remind = (dateDue: number) => {
    close();
    store.messages.remindAboutMessage(props.channelId, props.msg.ts, dateDue);
  };

  const runShortcut = (shortcut: MessageShortcut) => {
    close();
    store.resources.runMessageShortcutAt(props.channelId, props.msg.ts, shortcut);
  };

  const requestEdit = () => {
    close();
    props.onEditRequest();
  };

  const requestDelete = () => {
    close();
    confirmAndDeleteMessage(props.channelId, props.msg.ts);
  };

  return (
    <>
      <MenuItem icon="link" onClick={copyLink}>
        Copy link
      </MenuItem>
      <MenuItem
        disabled={store.pinned.isPinPending(props.channelId, props.msg.ts)}
        icon="pin"
        onClick={togglePin}
      >
        {isPinned() ? "Unpin from channel" : "Pin to channel"}
      </MenuItem>
      <Show when={canBroadcast()}>
        <MenuItem icon="channel" onClick={broadcastToChannel}>
          Also send to channel
        </MenuItem>
      </Show>
      <Menu
        class="message-more-item-wrap"
        onClose={() => setRemindOpen(false)}
        open={remindOpen()}
        panelClass="menu-panel message-more-submenu"
        placement="left"
        trigger={
          <MenuItem icon="clock" onClick={() => setRemindOpen(!remindOpen())}>
            Remind me
          </MenuItem>
        }
      >
        <For each={REMINDER_OPTIONS}>
          {(opt) => <MenuItem onClick={() => remind(opt.dateDue())}>{opt.label}</MenuItem>}
        </For>
      </Menu>
      <MenuItem icon="mark-as-unread" onClick={markUnread}>
        Mark unread
      </MenuItem>
      <MenuItem icon="text" onClick={copyText}>
        Copy text
      </MenuItem>
      <Show when={store.resources.messageShortcuts.loading}>
        <div aria-live="polite" class="menu-item disabled">
          <Icon name="apps" size={15} />
          Loading message shortcuts…
        </div>
      </Show>
      <Show when={store.resources.messageShortcuts.error}>
        <MenuItem icon="refresh" onClick={store.resources.retryMessageShortcuts}>
          Retry message shortcuts
        </MenuItem>
      </Show>
      <Show when={store.resources.messageShortcuts()?.length}>
        <Menu
          class="message-more-item-wrap"
          onClose={() => {
            setShortcutsOpen(false);
            setShortcutQuery("");
          }}
          open={shortcutsOpen()}
          panelClass="menu-panel message-shortcuts-menu"
          placement="left"
          trigger={
            <MenuItem icon="apps" onClick={toggleShortcuts}>
              More message shortcuts
            </MenuItem>
          }
        >
          <input
            autofocus
            class="search-input"
            onInput={(e) => setShortcutQuery(e.currentTarget.value)}
            placeholder="Search shortcuts"
            type="text"
            value={shortcutQuery()}
          />
          <div class="message-shortcuts-list flex-col">
            <For
              each={filteredShortcuts()}
              fallback={<div class="message-shortcuts-empty">No matching shortcuts</div>}
            >
              {(shortcut) => (
                <MenuItem
                  leading={
                    <Show fallback={<Icon name="apps" size={15} />} when={shortcut.icon}>
                      {(icon) => <img alt="" class="menu-item-app-icon" src={icon()} />}
                    </Show>
                  }
                  onClick={() => runShortcut(shortcut)}
                >
                  {shortcut.name}
                </MenuItem>
              )}
            </For>
          </div>
        </Menu>
      </Show>
      <Show when={isMine()}>
        <MenuItem icon="edit" onClick={requestEdit}>
          Edit message
        </MenuItem>
        <MenuItem danger icon="trash" onClick={requestDelete}>
          Delete message
        </MenuItem>
      </Show>
    </>
  );
}
