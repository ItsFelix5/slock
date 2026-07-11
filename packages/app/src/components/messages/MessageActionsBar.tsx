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
  isSavedForLater,
  markMessageUnread,
  messageShortcuts,
  REMINDER_OPTIONS,
  reactToMessage,
  recordEmojiUse,
  remindAboutMessage,
  runMessageShortcutAt,
  togglePinMessage,
  toggleSaveForLater,
} from "../../lib/store";
import EmojiPicker from "../composer/EmojiPicker";

export default function MessageActionsBar(props: {
  channelId: string;
  msg: Message;
  threadTs?: string;
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  onEditRequest: () => void;
}) {
  const [pickerOpen, setPickerOpen] = createSignal(false);
  const [pickerFlipUp, setPickerFlipUp] = createSignal(false);
  const [moreOpen, setMoreOpen] = createSignal(false);
  const [moreFlipUp, setMoreFlipUp] = createSignal(false);
  const [remindOpen, setRemindOpen] = createSignal(false);
  const [shortcutsOpen, setShortcutsOpen] = createSignal(false);
  const [shortcutsFlipUp, setShortcutsFlipUp] = createSignal(false);
  const [shortcutQuery, setShortcutQuery] = createSignal("");
  let pickerWrapRef: HTMLDivElement | undefined;
  let moreBtnRef: HTMLButtonElement | undefined;
  let shortcutsBtnRef: HTMLButtonElement | undefined;

  // The picker's own height (see EmojiPicker.css) plus a little breathing
  // room — if opening downward from here would run past the viewport bottom
  // (e.g. reacting on one of the last messages in the list), flip it to open
  // upward from the button instead so it's never clipped off-screen.
  const PICKER_HEIGHT = 400;
  const MORE_MENU_HEIGHT = 220;
  const SHORTCUTS_MENU_HEIGHT = 280;

  const filteredShortcuts = createMemo(() => {
    const all = messageShortcuts() ?? [];
    const q = shortcutQuery().trim();
    if (!q) return all;
    return fuzzySearch(all, { query: q, text: (s) => `${s.appName} ${s.name}` });
  });

  const togglePicker = () => {
    if (!pickerOpen() && pickerWrapRef) {
      const rect = pickerWrapRef.getBoundingClientRect();
      setPickerFlipUp(rect.bottom + PICKER_HEIGHT > window.innerHeight);
    }
    setPickerOpen(!pickerOpen());
  };

  const toggleMore = () => {
    if (!moreOpen() && moreBtnRef) {
      const rect = moreBtnRef.getBoundingClientRect();
      setMoreFlipUp(rect.bottom + MORE_MENU_HEIGHT > window.innerHeight);
    }
    setMoreOpen(!moreOpen());
    setRemindOpen(false);
    setShortcutsOpen(false);
    setShortcutQuery("");
  };

  const toggleShortcuts = () => {
    if (!shortcutsOpen() && shortcutsBtnRef) {
      const rect = shortcutsBtnRef.getBoundingClientRect();
      setShortcutsFlipUp(rect.bottom + SHORTCUTS_MENU_HEIGHT > window.innerHeight);
    }
    if (shortcutsOpen()) setShortcutQuery("");
    setShortcutsOpen(!shortcutsOpen());
  };

  // A broadcasted reply's own ts is just where it landed in the channel —
  // its actual thread lives at threadTs, so "reply in thread" must jump
  // there instead of opening a new thread rooted on the broadcast itself.
  const threadRootTs = createMemo(() =>
    props.msg.isBroadcast && props.msg.threadTs ? props.msg.threadTs : props.msg.ts,
  );

  const isMine = createMemo(() => currentUser()?.id === props.msg.userId);
  const isSaved = createMemo(() => isSavedForLater(props.msg.ts));
  const isPinned = createMemo(() => isMessagePinned(props.channelId, props.msg.ts));
  const canBroadcast = createMemo(
    () => !!props.threadTs && props.threadTs !== props.msg.ts && !props.msg.isBroadcast,
  );

  const copyText = () => {
    navigator.clipboard.writeText(parseReplyLink(props.msg.text)?.rest ?? props.msg.text);
    setMoreOpen(false);
  };

  const requestEdit = () => {
    setMoreOpen(false);
    props.onEditRequest();
  };

  const requestDelete = () => {
    setMoreOpen(false);
    if (confirm("Delete this message?")) deleteMessageAt(props.channelId, props.msg.ts);
  };

  const react = (name: string) => {
    recordEmojiUse(name);
    reactToMessage(props.channelId, props.msg, name);
    setPickerOpen(false);
  };

  const copyLink = () => {
    setMoreOpen(false);
    copyMessageLink(props.channelId, props.msg.ts);
  };

  const togglePin = () => {
    setMoreOpen(false);
    togglePinMessage(props.channelId, props.msg.ts);
  };

  const broadcastToChannel = () => {
    setMoreOpen(false);
    broadcastThreadReply(props.channelId, props.msg.ts);
  };

  const markUnread = () => {
    setMoreOpen(false);
    markMessageUnread(props.channelId, props.msg.ts);
  };

  const remind = (time: string) => {
    setMoreOpen(false);
    setRemindOpen(false);
    remindAboutMessage(props.channelId, props.msg.ts, time);
  };

  const runShortcut = (shortcut: MessageShortcut) => {
    setMoreOpen(false);
    setShortcutsOpen(false);
    setShortcutQuery("");
    runMessageShortcutAt(props.channelId, props.msg.ts, shortcut);
  };

  return (
    <div class="message-hover-actions" classList={{ "force-visible": pickerOpen() || moreOpen() }}>
      <div class="message-hover-picker-wrap" ref={pickerWrapRef}>
        <button type="button" class="message-hover-btn" title="React" onClick={togglePicker}>
          <Icon name="emoji" size={16} />
        </button>
        <Show when={pickerOpen()}>
          <div class="reaction-picker-full" classList={{ "flip-up": pickerFlipUp() }}>
            <EmojiPicker onSelect={react} onClose={() => setPickerOpen(false)} />
          </div>
        </Show>
      </div>

      <Show when={props.onOpenThread}>
        <button
          type="button"
          class="message-hover-btn"
          title="Reply in thread"
          onClick={() => props.onOpenThread?.(threadRootTs())}
        >
          <Icon name="threads" size={16} />
        </button>
      </Show>

      <Show when={props.onReplyLink}>
        <button
          type="button"
          class="message-hover-btn"
          title="Reply"
          onClick={() => props.onReplyLink?.(props.msg)}
        >
          <Icon name="email-reply" size={16} />
        </button>
      </Show>

      <button
        type="button"
        class="message-hover-btn"
        classList={{ active: isSaved() }}
        title={isSaved() ? "Remove from Later" : "Save for later"}
        onClick={() => toggleSaveForLater(props.channelId, props.msg.ts)}
      >
        <Icon name={isSaved() ? "bookmark-filled" : "bookmark"} size={15} />
      </button>

      <Menu
        class="message-hover-picker-wrap"
        panelClass={`menu-panel message-more-menu${moreFlipUp() ? " flip-up" : ""}`}
        open={moreOpen()}
        onClose={() => {
          setMoreOpen(false);
          setRemindOpen(false);
          setShortcutsOpen(false);
          setShortcutQuery("");
        }}
        trigger={
          <button
            ref={moreBtnRef}
            type="button"
            class="message-hover-btn"
            title="More actions"
            onClick={toggleMore}
          >
            <Icon name="ellipsis-vertical-filled" size={16} />
          </button>
        }
      >
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
              <button
                ref={shortcutsBtnRef}
                type="button"
                class="menu-item"
                onClick={toggleShortcuts}
              >
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
      </Menu>
    </div>
  );
}
