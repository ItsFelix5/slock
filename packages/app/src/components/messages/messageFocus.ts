import { useShortcut } from "@slock/ui";
import { type Accessor, createEffect, createSignal } from "solid-js";
import { isMine, type Message } from "../../lib/api";
import { copyMessageLink } from "../../lib/messageLinks";
import { threadContainsMessage } from "../../lib/replyLink";
import { store } from "../../lib/store";
import { findUnreadDividerIndex } from "./lib/unreadDivider";
import { confirmAndDeleteMessage, copyMessageText } from "./messageActions";
import { resolveProfileUserId } from "./parts/messageRenderState";

export interface OpenThreadOptions {
  autofocus?: boolean;
  pinned?: boolean;
}

export type OpenThreadHandler = (ts: string, opts?: OpenThreadOptions) => void;

export interface MessageFocusCallbacks {
  onOpenThread?: OpenThreadHandler;
  onReplyLink?: (msg: Message) => void;

  threadTs?: Accessor<string | undefined>;
}

export function createMessageFocus(
  messages: Accessor<Message[]>,
  container: Accessor<HTMLElement | undefined>,
  channelId: Accessor<string>,
  callbacks: MessageFocusCallbacks = {},
) {
  const [focusedTs, setFocusedTs] = createSignal<string | null>(null);
  const [editingTs, setEditingTs] = createSignal<string | null>(null);
  const [listFocused, setListFocused] = createSignal(false);

  createEffect(() => {
    const list = messages();
    const current = focusedTs();
    if (!list.length) {
      if (current !== null) setFocusedTs(null);
      return;
    }
    if (current === null || !list.some((m) => m.ts === current)) {
      const anchor = store.unread.unreadDividerTsForChannel(channelId());
      const unreadIndex = findUnreadDividerIndex(list, anchor);
      setFocusedTs(list[unreadIndex >= 0 ? unreadIndex : list.length - 1].ts);
    }
  });

  function focusRow(ts: string, opts?: { preventScroll?: boolean }) {
    setFocusedTs(ts);
    const row = container()?.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
    if (opts?.preventScroll) row?.focus({ preventScroll: true });
    else {
      row?.focus();
      row?.scrollIntoView({ block: "nearest" });
    }
  }

  function moveFocus(delta: number) {
    const list = messages();
    if (!list.length) return;
    const currentIndex = list.findIndex((m) => m.ts === focusedTs());
    const nextIndex = Math.max(
      0,
      Math.min(list.length - 1, currentIndex < 0 ? list.length - 1 : currentIndex + delta),
    );
    const next = list[nextIndex];
    if (!next) return;
    focusRow(next.ts);
  }

  const focusedMessage = () => {
    const ts = focusedTs();
    return ts === null ? undefined : messages().find((m) => m.ts === ts);
  };

  const isOwnEditableMessage = () => {
    const msg = focusedMessage();
    if (!msg || msg.deleted || msg.isEphemeral) return false;
    return isMine(msg);
  };

  const startEdit = (ts: string) => {
    if (focusedTs() === ts) setEditingTs(ts);
  };
  const stopEdit = () => setEditingTs(null);

  const clickRowButton = (ariaLabel: string) => {
    const ts = focusedTs();
    if (ts === null) return;
    const button = container()?.querySelector<HTMLElement>(
      `[data-message-ts="${CSS.escape(ts)}"] [aria-label="${ariaLabel}"]`,
    );
    button?.focus();
    button?.click();
  };

  useShortcut({
    allowRepeat: true,
    combo: { key: "ArrowDown" },
    enabled: () => listFocused() && focusedTs() !== null,
    handler: () => moveFocus(1),
    id: "messages.focusNext",
    label: "Move focus to the next message",
    scope: "messages",
  });

  useShortcut({
    allowRepeat: true,
    combo: { key: "ArrowUp" },
    enabled: () => listFocused() && focusedTs() !== null,
    handler: () => moveFocus(-1),
    id: "messages.focusPrev",
    label: "Move focus to the previous message",
    scope: "messages",
  });

  const messageActionEnabled = () => listFocused() && focusedTs() !== null;

  useShortcut({
    combo: { key: "r" },
    enabled: () => messageActionEnabled() && (!!callbacks.onOpenThread || !!callbacks.onReplyLink),
    handler: () => {
      const msg = focusedMessage();
      if (!msg) return;
      if (callbacks.onOpenThread) callbacks.onOpenThread(msg.ts, { autofocus: false });
      else callbacks.onReplyLink?.(msg);
    },
    id: "messages.reply",
    label: "Reply",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "r", shift: true },
    enabled: () => messageActionEnabled() && !!callbacks.onOpenThread,
    handler: () => {
      const msg = focusedMessage();
      if (!msg) return;
      callbacks.onOpenThread?.(msg.ts, { autofocus: false, pinned: true });
    },
    id: "messages.replySplit",
    label: "Reply in a new split",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "a" },
    enabled: messageActionEnabled,
    handler: () => clickRowButton("React"),
    id: "messages.react",
    label: "Add a reaction",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "s" },
    enabled: messageActionEnabled,
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) store.later.toggleSaveForLater(channelId(), ts);
    },
    id: "messages.saveForLater",
    label: "Save / unsave for later",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "p" },
    enabled: messageActionEnabled,
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) store.pinned.togglePinMessage(channelId(), ts);
    },
    id: "messages.pin",
    label: "Pin / unpin",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "c" },
    enabled: messageActionEnabled,
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) copyMessageLink(channelId(), ts, callbacks.threadTs?.());
    },
    id: "messages.copyLink",
    label: "Copy link",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "y" },
    enabled: messageActionEnabled,
    handler: () => {
      const msg = focusedMessage();
      if (!msg) return;
      const threadTs = callbacks.threadTs?.();
      void copyMessageText(msg, (candidateChannelId, ts) =>
        threadContainsMessage(
          channelId(),
          threadTs,
          store.messages.messagesInThread(threadTs ?? "") ?? [],
          candidateChannelId,
          ts,
        ),
      );
    },
    id: "messages.copyText",
    label: "Copy text",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "v" },
    enabled: messageActionEnabled,
    handler: () => {
      const msg = focusedMessage();
      const id = msg && resolveProfileUserId(msg);
      if (id) store.users.openUserProfile(id);
    },
    id: "messages.viewProfile",
    label: "View author's profile",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "u" },
    enabled: messageActionEnabled,
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) store.messages.markMessageUnread(channelId(), ts);
    },
    id: "messages.markUnread",
    label: "Mark unread",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "e" },
    enabled: () => listFocused() && isOwnEditableMessage(),
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) startEdit(ts);
    },
    id: "messages.edit",
    label: "Edit message",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "d" },
    enabled: () => listFocused() && isOwnEditableMessage(),
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) confirmAndDeleteMessage(channelId(), ts);
    },
    id: "messages.delete",
    label: "Delete message",
    scope: "messages",
  });

  useShortcut({
    combo: { key: "." },
    enabled: messageActionEnabled,
    handler: () => clickRowButton("More actions"),
    id: "messages.moreActions",
    label: "More actions (remind me, also send to channel, app shortcuts, …)",
    scope: "messages",
  });

  return {
    editingTs,
    focusMessage: (ts: string) => focusRow(ts, { preventScroll: true }),
    focusedTs,

    listFocused,
    onContainerFocusIn: (e: FocusEvent) => {
      setListFocused(true);

      const target = e.target instanceof Element ? e.target : null;
      const ts = target?.closest<HTMLElement>("[data-message-ts]")?.dataset.messageTs;
      if (ts) setFocusedTs(ts);
    },
    onContainerFocusOut: (e: FocusEvent & { currentTarget: HTMLElement }) => {
      if (!(e.relatedTarget instanceof Node && e.currentTarget.contains(e.relatedTarget))) {
        setListFocused(false);
      }
    },
    onStartEdit: startEdit,
    onStopEdit: stopEdit,
  };
}
