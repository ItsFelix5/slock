import type { Message } from "@slock/types";
import { useListShortcuts, useShortcut } from "@slock/ui";
import { copyMessageLink } from "../../lib/messageLinks";
import { store } from "../../lib/store";
import { confirmAndDeleteMessage, copyMessageText } from "./messageActions";
import { type ActiveMessageFocus, active } from "./messageFocus";
import { resolveProfileUserId } from "./parts/messageAuthor";

export function useMessageShortcuts() {
  const enabled = () => active()?.focusedTs() != null;
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

  useShortcut({
    combo: { key: "r" },
    enabled: () =>
      enabled() && !!(active()?.callbacks.onOpenThread || active()?.callbacks.onReplyLink),
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
    enabled,
    handler: withFocused((focus, ts) => focus.toggleReactionPicker(ts)),
    id: "messages.react",
    label: "Add a reaction",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "s" },
    enabled,
    handler: withFocused((focus, ts) => store.later.toggleSaveForLater(focus.channelId(), ts)),
    id: "messages.saveForLater",
    label: "Save / unsave for later",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "p" },
    enabled,
    handler: withFocused((focus, ts) => store.pinned.togglePinMessage(focus.channelId(), ts)),
    id: "messages.pin",
    label: "Pin / unpin",
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
      if (id) store.users.openUserProfile(id);
    }),
    id: "messages.viewProfile",
    label: "View author's profile",
    scope: "messages",
    group: "Message actions",
  });

  useShortcut({
    combo: { key: "u" },
    enabled,
    handler: withFocused((focus, ts) => store.messages.toggleMessageUnread(focus.channelId(), ts)),
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
    enabled: () => enabled() && !!active()?.isOwnEditableMessage(),
    handler: withFocused((focus, ts) => confirmAndDeleteMessage(focus.channelId(), ts)),
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
