import { plainKey, useShortcut } from "@slock/ui";
import { type Accessor, createEffect, createSignal } from "solid-js";
import type { Message } from "../../lib/api";
import { copyMessageLink } from "../../lib/messageLinks";
import { threadContainsMessage } from "../../lib/replyLink";
import { store } from "../../lib/store";
import { confirmAndDeleteMessage, copyMessageText } from "./messageActions";
import { resolveProfileUserId } from "./parts/messageRenderState";

export interface MessageFocusCallbacks {
  onOpenThread?: (ts: string, opts?: { pinned?: boolean }) => void;
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
      setFocusedTs(list[list.length - 1].ts);
    }
  });

  function focusRow(ts: string) {
    setFocusedTs(ts);
    const row = container()?.querySelector<HTMLElement>(`[data-message-ts="${CSS.escape(ts)}"]`);
    row?.focus();
    row?.scrollIntoView({ block: "nearest" });
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
    return (
      !!msg && msg.userId === store.users.currentUser()?.id && !msg.deleted && !msg.isEphemeral
    );
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
    enabled: () => listFocused() && focusedTs() !== null,
    handler: (e) => moveFocus(e.key === "ArrowDown" ? 1 : -1),
    keys: "↑ / ↓",
    label: "Move focus between messages",
    match: (e) => e.key === "ArrowDown" || e.key === "ArrowUp",
    scope: "messages",
  });

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
    enabled: () => messageActionEnabled() && !!callbacks.onOpenThread,
    handler: () => {
      const msg = focusedMessage();
      if (msg) callbacks.onOpenThread?.(msg.ts, { pinned: true });
    },
    keys: "Shift R",
    label: "Reply in a new split",
    match: plainKey("R"),
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
      if (ts !== null) copyMessageLink(channelId(), ts, callbacks.threadTs?.());
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
      if (!msg) return;
      const threadTs = callbacks.threadTs?.();
      void copyMessageText(msg, (candidateChannelId, ts) =>
        threadContainsMessage(
          channelId(),
          threadTs,
          store.messages.threadMessages[threadTs ?? ""] ?? [],
          candidateChannelId,
          ts,
        ),
      );
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

    listFocused,
    onContainerFocusIn: (e: FocusEvent) => {
      setListFocused(true);

      const ts = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-message-ts]")
        ?.dataset.messageTs;
      if (ts) setFocusedTs(ts);
    },
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
