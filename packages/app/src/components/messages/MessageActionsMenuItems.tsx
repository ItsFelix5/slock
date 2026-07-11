import type { Message, MessageShortcut } from "@slock/slack-api";
import { fuzzySearch, Icon, Menu } from "@slock/ui";
import { createMemo, createSignal, For, Show } from "solid-js";
import { parseReplyLink } from "../../lib/replyLink";
import {
  broadcastThreadReply,
  copyMessageLink,
  currentUser,
  deleteMessageAt,
  isMessagePinned,
  markMessageUnread,
  messageShortcuts,
  REMINDER_OPTIONS,
  remindAboutMessage,
  runMessageShortcutAt,
  togglePinMessage,
} from "../../lib/store";

export interface MessageActionsMenuItemsProps {
  channelId: string;
  msg: Message;
  threadTs?: string;
  onEditRequest: () => void;
  onClose: () => void;
}

// The message "..." menu's contents — shared between the hover toolbar's more-actions
// Menu and a message row's right-click ContextMenu, so both stay in sync for free.
export default function MessageActionsMenuItems(props: MessageActionsMenuItemsProps) {
  const [remindOpen, setRemindOpen] = createSignal(false);
  const [shortcutsOpen, setShortcutsOpen] = createSignal(false);
  const [shortcutsFlipUp, setShortcutsFlipUp] = createSignal(false);
  const [shortcutQuery, setShortcutQuery] = createSignal("");
  let shortcutsBtnRef: HTMLButtonElement | undefined;

  const SHORTCUTS_MENU_HEIGHT = 280;

  const filteredShortcuts = createMemo(() => {
    const all = messageShortcuts() ?? [];
    const q = shortcutQuery().trim();
    if (!q) return all;
    return fuzzySearch(all, { query: q, text: (s) => `${s.appName} ${s.name}` });
  });

  const toggleShortcuts = () => {
    if (!shortcutsOpen() && shortcutsBtnRef) {
      const rect = shortcutsBtnRef.getBoundingClientRect();
      setShortcutsFlipUp(rect.top + SHORTCUTS_MENU_HEIGHT > window.innerHeight);
    }
    if (shortcutsOpen()) setShortcutQuery("");
    setShortcutsOpen(!shortcutsOpen());
  };

  const isMine = createMemo(() => currentUser()?.id === props.msg.userId);
  const isPinned = createMemo(() => isMessagePinned(props.channelId, props.msg.ts));
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
    copyMessageLink(props.channelId, props.msg.ts);
  };

  const togglePin = () => {
    close();
    togglePinMessage(props.channelId, props.msg.ts);
  };

  const broadcastToChannel = () => {
    close();
    broadcastThreadReply(props.channelId, props.msg.ts);
  };

  const markUnread = () => {
    close();
    markMessageUnread(props.channelId, props.msg.ts);
  };

  const copyText = () => {
    close();
    navigator.clipboard.writeText(parseReplyLink(props.msg.text)?.rest ?? props.msg.text);
  };

  const remind = (time: string) => {
    close();
    remindAboutMessage(props.channelId, props.msg.ts, time);
  };

  const runShortcut = (shortcut: MessageShortcut) => {
    close();
    runMessageShortcutAt(props.channelId, props.msg.ts, shortcut);
  };

  const requestEdit = () => {
    close();
    props.onEditRequest();
  };

  const requestDelete = () => {
    close();
    if (confirm("Delete this message?")) deleteMessageAt(props.channelId, props.msg.ts);
  };

  return (
    <>
      <button type="button" class="menu-item" onClick={copyLink}>
        <Icon name="link" size={15} />
        Copy link
      </button>
      <button type="button" class="menu-item" onClick={togglePin}>
        <Icon name="pin" size={15} />
        {isPinned() ? "Unpin from channel" : "Pin to channel"}
      </button>
      <Show when={canBroadcast()}>
        <button type="button" class="menu-item" onClick={broadcastToChannel}>
          <Icon name="channel" size={15} />
          Also send to channel
        </button>
      </Show>
      <Menu
        class="message-more-item-wrap"
        panelClass="menu-panel message-more-submenu"
        open={remindOpen()}
        onClose={() => setRemindOpen(false)}
        trigger={
          <button type="button" class="menu-item" onClick={() => setRemindOpen(!remindOpen())}>
            <Icon name="clock" size={15} />
            Remind me
          </button>
        }
      >
        <For each={REMINDER_OPTIONS}>
          {(opt) => (
            <button type="button" class="menu-item" onClick={() => remind(opt.time)}>
              {opt.label}
            </button>
          )}
        </For>
      </Menu>
      <button type="button" class="menu-item" onClick={markUnread}>
        <Icon name="mark-as-unread" size={15} />
        Mark unread
      </button>
      <button type="button" class="menu-item" onClick={copyText}>
        <Icon name="text" size={15} />
        Copy text
      </button>
      <Show when={messageShortcuts()?.length}>
        <Menu
          class="message-more-item-wrap"
          panelClass={`menu-panel message-shortcuts-menu${shortcutsFlipUp() ? " flip-up" : ""}`}
          open={shortcutsOpen()}
          onClose={() => {
            setShortcutsOpen(false);
            setShortcutQuery("");
          }}
          trigger={
            <button ref={shortcutsBtnRef} type="button" class="menu-item" onClick={toggleShortcuts}>
              <Icon name="apps" size={15} />
              More message shortcuts
            </button>
          }
        >
          <input
            class="search-input"
            type="text"
            placeholder="Search shortcuts"
            value={shortcutQuery()}
            onInput={(e) => setShortcutQuery(e.currentTarget.value)}
            autofocus
          />
          <div class="message-shortcuts-list">
            <For
              each={filteredShortcuts()}
              fallback={<div class="message-shortcuts-empty">No matching shortcuts</div>}
            >
              {(shortcut) => (
                <button type="button" class="menu-item" onClick={() => runShortcut(shortcut)}>
                  <Show when={shortcut.icon} fallback={<Icon name="apps" size={15} />}>
                    {(icon) => <img class="menu-item-app-icon" src={icon()} alt="" />}
                  </Show>
                  {shortcut.name}
                </button>
              )}
            </For>
          </div>
        </Menu>
      </Show>
      <Show when={isMine()}>
        <button type="button" class="menu-item" onClick={requestEdit}>
          <Icon name="edit" size={15} />
          Edit message
        </button>
        <button type="button" class="menu-item danger" onClick={requestDelete}>
          <Icon name="trash" size={15} />
          Delete message
        </button>
      </Show>
    </>
  );
}
