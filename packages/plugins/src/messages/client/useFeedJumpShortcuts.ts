import { service } from "@slock/core/solid";
import { useShortcut } from "@slock/ui";

const panesStore = service("shell.panes");

export function useFeedJumpShortcuts(options: {
  active: () => boolean;
  hasUnread: () => boolean;
  jumpToLatest: () => void;
  jumpToUnread: () => void;
  paneId: string;
}) {
  const focused = () => options.active() && panesStore.focusedPaneId() === options.paneId;
  useShortcut({
    allowInInputs: true,
    combo: { alt: true, key: "ArrowUp" },
    enabled: () => focused() && options.hasUnread(),
    group: "Message actions",
    handler: options.jumpToUnread,
    id: "messages.jumpToUnread",
    label: "Jump to the first unread message",
    scope: "messages",
  });
  useShortcut({
    allowInInputs: true,
    combo: { alt: true, key: "ArrowDown" },
    enabled: focused,
    group: "Message actions",
    handler: options.jumpToLatest,
    id: "messages.jumpToLatest",
    label: "Jump to the latest message",
    scope: "messages",
  });
}
