import type { Message, MessageShortcut } from "@slock/slack-api";
import { fuzzySearch, Icon, Menu } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { parseReplyLink } from "../../../lib/replyLink";
import { REMINDER_OPTIONS, store } from "../../../lib/store";

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
  const [shortcutsFlipUp, setShortcutsFlipUp] = createSignal(false);
  const [shortcutQuery, setShortcutQuery] = createSignal("");
  let shortcutsBtnRef: HTMLButtonElement | undefined;

  const ShortcutsMenuHeight = 280;

  const filteredShortcuts = createMemo(() => {
    const all: MessageShortcut[] = store.resources.messageShortcuts() ?? [];
    const q = shortcutQuery().trim();
    if (!q) return all;
    return fuzzySearch(all, { query: q, text: (s) => `${s.appName} ${s.name}` });
  });

  const toggleShortcuts = () => {
    if (!shortcutsOpen() && shortcutsBtnRef) {
      const rect = shortcutsBtnRef.getBoundingClientRect();
      setShortcutsFlipUp(rect.bottom + ShortcutsMenuHeight > window.innerHeight);
    }
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
    navigator.clipboard.writeText(parseReplyLink(props.msg.text)?.rest ?? props.msg.text);
  };

  const remind = (time: string) => {
    close();
    store.messages.remindAboutMessage(props.channelId, props.msg.ts, time);
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
    if (confirm("Delete this message?"))
      store.messages.deleteMessageAt(props.channelId, props.msg.ts);
  };

  return (
    <>
      <button class="menu-item" onClick={copyLink} type="button">
        <Icon name="link" size={15} />
        Copy link
      </button>
      <button class="menu-item" onClick={togglePin} type="button">
        <Icon name="pin" size={15} />
        {isPinned() ? "Unpin from channel" : "Pin to channel"}
      </button>
      <Show when={canBroadcast()}>
        <button class="menu-item" onClick={broadcastToChannel} type="button">
          <Icon name="channel" size={15} />
          Also send to channel
        </button>
      </Show>
      <Menu
        class="message-more-item-wrap"
        onClose={() => setRemindOpen(false)}
        open={remindOpen()}
        panelClass="menu-panel message-more-submenu"
        trigger={
          <button class="menu-item" onClick={() => setRemindOpen(!remindOpen())} type="button">
            <Icon name="clock" size={15} />
            Remind me
          </button>
        }
      >
        <For each={REMINDER_OPTIONS}>
          {(opt) => (
            <button class="menu-item" onClick={() => remind(opt.time)} type="button">
              {opt.label}
            </button>
          )}
        </For>
      </Menu>
      <button class="menu-item" onClick={markUnread} type="button">
        <Icon name="mark-as-unread" size={15} />
        Mark unread
      </button>
      <button class="menu-item" onClick={copyText} type="button">
        <Icon name="text" size={15} />
        Copy text
      </button>
      <Show when={store.resources.messageShortcuts()?.length}>
        <Menu
          class="message-more-item-wrap"
          onClose={() => {
            setShortcutsOpen(false);
            setShortcutQuery("");
          }}
          open={shortcutsOpen()}
          panelClass={`menu-panel message-shortcuts-menu${shortcutsFlipUp() ? " flip-up" : ""}`}
          trigger={
            <button class="menu-item" onClick={toggleShortcuts} ref={shortcutsBtnRef} type="button">
              <Icon name="apps" size={15} />
              More message shortcuts
            </button>
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
                <button class="menu-item" onClick={() => runShortcut(shortcut)} type="button">
                  <Show fallback={<Icon name="apps" size={15} />} when={shortcut.icon}>
                    {(icon) => <img alt="" class="menu-item-app-icon" src={icon()} />}
                  </Show>
                  {shortcut.name}
                </button>
              )}
            </For>
          </div>
        </Menu>
      </Show>
      <Show when={isMine()}>
        <button class="menu-item" onClick={requestEdit} type="button">
          <Icon name="edit" size={15} />
          Edit message
        </button>
        <button class="menu-item danger" onClick={requestDelete} type="button">
          <Icon name="trash" size={15} />
          Delete message
        </button>
      </Show>
    </>
  );
}
