import type { Message } from "@slock/slack-api";
import { plainKey, useShortcut } from "@slock/ui";
import { type Accessor, createEffect, createSignal } from "solid-js";
import { store } from "../../lib/store";
import { confirmAndDeleteMessage, copyMessageText } from "./messageActions";
import { resolveProfileUserId } from "./parts/messageRenderState";
import { waitForMessageElement } from "./scrollAnchor";
import type { VirtualRowsApi } from "./VirtualizedRows";

export interface MessageFocusCallbacks {
  onOpenThread?: (ts: string) => void;
  onReplyLink?: (msg: Message) => void;
  // Current thread context (if any), used only to match MessageActionsMenuItems'
  // copy-text behavior of stripping a reply-link prefix for in-thread replies.
  threadTs?: Accessor<string | undefined>;
}

// Drives roving-tabindex keyboard navigation across a message list: exactly
// one row is ever focusable (tabIndex 0) at a time, ArrowUp/ArrowDown move it,
// and a full set of single-key shortcuts act on whichever message is focused.
export function createMessageFocus(
  messages: Accessor<Message[]>,
  virtualApi: Accessor<VirtualRowsApi | null>,
  container: Accessor<HTMLElement | undefined>,
  channelId: Accessor<string>,
  callbacks: MessageFocusCallbacks = {},
) {
  const [focusedTs, setFocusedTs] = createSignal<string | null>(null);
  const [editingTs, setEditingTs] = createSignal<string | null>(null);
  const [listFocused, setListFocused] = createSignal(false);
  let cancelWait: (() => void) | undefined;

  // Keeps exactly one row tabbable: seeds the initial focus once messages
  // arrive, and recovers (rather than pointing at nothing) if the focused
  // message scrolled out of the loaded window or the channel changed.
  createEffect(() => {
    const list = messages();
    const current = focusedTs();
    if (!list.length) {
      if (current !== null) setFocusedTs(null);
      return;
    }
    if (current === null || !list.some((m) => m.ts === current)) {
      setFocusedTs(list[list.length - 1].ts);
    }
  });

  function focusRow(ts: string) {
    setFocusedTs(ts);
    container()
      ?.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`)
      ?.focus();
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

    cancelWait?.();
    const api = virtualApi();
    const el = container();
    if (!(api && el)) {
      focusRow(next.ts);
      return;
    }
    api.scrollToIndex(nextIndex, { align: "auto" });
    cancelWait = waitForMessageElement(el, next.ts, (row) => {
      setFocusedTs(next.ts);
      row.focus();
    });
  }

  const focusedMessage = () => {
    const ts = focusedTs();
    return ts === null ? undefined : messages().find((m) => m.ts === ts);
  };

  const isOwnEditableMessage = () => {
    const msg = focusedMessage();
    return (
      !!msg && msg.userId === store.users.currentUser()?.id && !msg.deleted && !msg.isEphemeral
    );
  };

  const startEdit = (ts: string) => {
    if (focusedTs() === ts) setEditingTs(ts);
  };
  const stopEdit = () => setEditingTs(null);

  const isInThread = (candidateChannelId: string, ts: string) => {
    const threadTs = callbacks.threadTs?.();
    return (
      !!threadTs &&
      candidateChannelId === channelId() &&
      (ts === threadTs ||
        (store.messages.threadMessages[threadTs]?.some((m) => m.ts === ts) ?? false))
    );
  };

  // Reuses the row's own hover-toolbar button via a synthetic click rather
  // than lifting its open/close state — inherits that button's existing
  // (already keyboard-complete) picker/menu behavior for free.
  const clickRowButton = (ariaLabel: string) => {
    const ts = focusedTs();
    if (ts === null) return;
    container()
      ?.querySelector<HTMLElement>(
        `[data-message-ts="${CSS.escape(ts)}"] [aria-label="${ariaLabel}"]`,
      )
      ?.click();
  };

  useShortcut({
    allowRepeat: true,
    enabled: () => listFocused() && focusedTs() !== null,
    handler: (e) => moveFocus(e.key === "ArrowDown" ? 1 : -1),
    keys: "↑ / ↓",
    label: "Move focus between messages",
    match: (e) => e.key === "ArrowDown" || e.key === "ArrowUp",
    scope: "messages",
  });

  // All the single-key actions below only make sense while a message row
  // genuinely has DOM focus (listFocused) — focusedTs itself never goes back
  // to null just because focus moved elsewhere (it has to keep pointing at
  // *some* message for roving-tabindex), so without the listFocused() check
  // these kept firing anywhere else in the app, including "d" opening a
  // delete confirmation for a message that isn't even visible anymore.
  const messageActionEnabled = () => listFocused() && focusedTs() !== null;

  useShortcut({
    enabled: () => messageActionEnabled() && (!!callbacks.onOpenThread || !!callbacks.onReplyLink),
    handler: () => {
      const msg = focusedMessage();
      if (!msg) return;
      if (callbacks.onOpenThread) callbacks.onOpenThread(msg.ts);
      else callbacks.onReplyLink?.(msg);
    },
    keys: "r",
    label: "Reply",
    match: plainKey("r"),
    scope: "messages",
  });

  useShortcut({
    enabled: messageActionEnabled,
    handler: () => clickRowButton("React"),
    keys: "a",
    label: "Add a reaction",
    match: plainKey("a"),
    scope: "messages",
  });

  useShortcut({
    enabled: messageActionEnabled,
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) store.later.toggleSaveForLater(channelId(), ts);
    },
    keys: "s",
    label: "Save / unsave for later",
    match: plainKey("s"),
    scope: "messages",
  });

  useShortcut({
    enabled: messageActionEnabled,
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) store.pinned.togglePinMessage(channelId(), ts);
    },
    keys: "p",
    label: "Pin / unpin",
    match: plainKey("p"),
    scope: "messages",
  });

  useShortcut({
    enabled: messageActionEnabled,
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) store.messages.copyMessageLink(channelId(), ts);
    },
    keys: "c",
    label: "Copy link",
    match: plainKey("c"),
    scope: "messages",
  });

  useShortcut({
    enabled: messageActionEnabled,
    handler: () => {
      const msg = focusedMessage();
      if (msg) void copyMessageText(msg, isInThread);
    },
    keys: "y",
    label: "Copy text",
    match: plainKey("y"),
    scope: "messages",
  });

  useShortcut({
    enabled: messageActionEnabled,
    handler: () => {
      const msg = focusedMessage();
      const id = msg && resolveProfileUserId(msg);
      if (id) store.users.openUserProfile(id);
    },
    keys: "v",
    label: "View author's profile",
    match: plainKey("v"),
    scope: "messages",
  });

  useShortcut({
    enabled: messageActionEnabled,
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) store.messages.markMessageUnread(channelId(), ts);
    },
    keys: "u",
    label: "Mark unread",
    match: plainKey("u"),
    scope: "messages",
  });

  useShortcut({
    enabled: () => listFocused() && isOwnEditableMessage(),
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) startEdit(ts);
    },
    keys: "e",
    label: "Edit message",
    match: plainKey("e"),
    scope: "messages",
  });

  useShortcut({
    enabled: () => listFocused() && isOwnEditableMessage(),
    handler: () => {
      const ts = focusedTs();
      if (ts !== null) confirmAndDeleteMessage(channelId(), ts);
    },
    keys: "d",
    label: "Delete message",
    match: plainKey("d"),
    scope: "messages",
  });

  useShortcut({
    enabled: messageActionEnabled,
    handler: () => clickRowButton("More actions"),
    keys: ".",
    label: "More actions (remind me, also send to channel, app shortcuts, …)",
    match: plainKey("."),
    scope: "messages",
  });

  return {
    editingTs,
    focusedTs,
    onContainerFocusIn: () => setListFocused(true),
    onContainerFocusOut: (e: FocusEvent) => {
      const el = e.currentTarget as HTMLElement;
      if (!(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) {
        setListFocused(false);
      }
    },
    onStartEdit: startEdit,
    onStopEdit: stopEdit,
  };
}
