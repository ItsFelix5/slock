import { service } from "@slock/core/solid";
import type { Message } from "@slock/types";
import { useListShortcuts, useShortcut } from "@slock/ui";
import { copyMessageLink } from "../../message-links/client/api/messageLinks";
import { resolveProfileUserId } from "./api/messageAuthor";
import { type ActiveMessageFocus, active } from "./api/messageFocus";
import { copyMessageText, deleteOrDismissMessage } from "./messageActions";
import { stepMessageItem } from "./messageItemFocus";

const usersStore = service("users");
const messagesStore = service("messages");

export function useMessageShortcuts() {
  const enabled = () => active()?.focusedTs() != null;
  const liveEnabled = () => active()?.focusedLiveTs() != null;
  const withFocused = (run: (focus: ActiveMessageFocus, ts: string) => void) => () => {
    const focus = active();
    const ts = focus?.focusedTs();
    if (focus && ts != null) run(focus, ts);
  };
  const withMessage =
    (run: (focus: ActiveMessageFocus, msg: Message, event: KeyboardEvent) => void) =>
    (event: KeyboardEvent) => {
      const focus = active();
      const msg = focus?.focusedMessage();
      if (focus && msg) run(focus, msg, event);
    };

  useListShortcuts({
    allowInInputs: false,
    enabled,
    move: (direction) => {
      const focus = active();
      if (direction === "start") focus?.focusEdge("start");
      else if (direction === "end") focus?.focusEdge("end");
      else focus?.moveFocus(direction === "down" ? 1 : -1);
    },
  });

  const stepItem = (delta: 1 | -1) => () => {
    const ts = active()?.focusedTs();
    if (ts != null)
      stepMessageItem(document.querySelector(`[data-message-ts="${CSS.escape(ts)}"]`), delta);
  };

  useShortcut({
    combo: { key: "ArrowRight" },
    enabled,
    handler: stepItem(1),
    id: "messages.nextItem",
    label: "Next file, button or link in message",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "ArrowLeft" },
    enabled,
    handler: stepItem(-1),
    id: "messages.prevItem",
    label: "Previous file, button or link in message",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "r" },
    enabled: () =>
      liveEnabled() && !!(active()?.callbacks.onOpenThread || active()?.callbacks.onReplyLink),
    handler: withMessage(({ callbacks }, msg, event) => {
      if (callbacks.onOpenThread) callbacks.onOpenThread(msg.ts, { pinned: event.shiftKey });
      else callbacks.onReplyLink?.(msg);
    }),
    id: "messages.reply",
    label: "Reply",
    scope: "messages",
    group: "Message actions",
    splitModifier: true,
  });

  useShortcut({
    combo: { key: "a" },
    enabled: liveEnabled,
    handler: withFocused((focus, ts) => focus.toggleReactionPicker(ts)),
    id: "messages.react",
    label: "Add a reaction",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "c" },
    enabled,
    handler: withFocused((focus, ts) =>
      copyMessageLink(focus.channelId(), ts, focus.callbacks.threadTs?.()),
    ),
    id: "messages.copyLink",
    label: "Copy link",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "y" },
    enabled,
    handler: withMessage((_, msg) => copyMessageText(msg)),
    id: "messages.copyText",
    label: "Copy text",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "v" },
    enabled,
    handler: withMessage((_, msg) => {
      const id = resolveProfileUserId(msg);
      if (id) usersStore.openUserProfile(id);
    }),
    id: "messages.viewProfile",
    label: "View author's profile",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "u" },
    enabled: liveEnabled,
    handler: withFocused((focus, ts) => messagesStore.toggleMessageUnread(focus.channelId(), ts)),
    id: "messages.markUnread",
    label: "Toggle unread",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "e" },
    enabled: () => enabled() && !!active()?.isOwnEditableMessage(),
    handler: withFocused((focus, ts) => focus.startEdit(ts)),
    id: "messages.edit",
    label: "Edit message",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "Delete" },
    enabled: () => {
      const focus = active();
      return enabled() && (!!focus?.isOwnEditableMessage() || !!focus?.focusedMessage()?.deleted);
    },
    handler: withFocused((focus) => {
      const msg = focus.focusedMessage();
      if (msg) deleteOrDismissMessage(focus.channelId(), msg);
    }),
    id: "messages.delete",
    label: "Delete message",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "." },
    enabled,
    handler: withFocused((focus, ts) => focus.toggleMoreMenu(ts)),
    id: "messages.moreActions",
    label: "More actions",
    scope: "messages",
    group: "Message actions",
  });
}
