import type { BlockKitResolver } from "@slock/blockkit";
import type { Attachment, Message, User } from "@slock/types";
import type { Accessor, Component, JSX } from "solid-js";
import type { PaneContentOf } from "../../shell/client/api/types";
import type { createMessagesStore } from "./store";

export type ThreadRef = { channelId: string; ts: string; highlightTs?: string };

export type ThreadPaneContent = PaneContentOf<"thread">;

export type MessageBadgeProps = {
  message: Message;
  channelId: string;
  threadTs?: string;
  showBroadcast: boolean;
};

export type MessageBodyProps = {
  msg: Message;
  channelId: string;
  threadTs?: string;
  isEditing: boolean;
  attachments?: Attachment[];
  onOpenThread?: (ts: string, options?: { pinned?: boolean }) => void;
};

export type MessageFooterProps = { channelId: string; threadTs?: string };

export type MessageMenuProps = {
  channelId: string;
  msg: Message;
  threadTs?: string;
  close(): void;
  edit(): void;
};

export type MessageBarProps = {
  channelId: string;
  msg: Message;
  threadTs?: string;
  onOpenThread?: (ts: string, options?: { pinned?: boolean }) => void;
  onReplyLink?: (msg: Message) => void;
  onEditRequest: () => void;
  rowFocused: () => boolean;
  reactionPickerTs: () => string | null;
  onToggleReactionPicker: (ts: string) => void;
};

export type MessageDeletedHook = (channelId: string, ts: string) => void;

export type MessagePatchHook = (
  current: Message,
  patch: Partial<Message>,
) => Partial<Message> | undefined;

export type MessageEditedProps = { msg: Message };

export type MessageQuote = (msg: Message, channelId: string) => JSX.Element | undefined;

export type MessageAuthorProps = {
  userId: Accessor<string | undefined>;
  user: Accessor<User | undefined>;
  visible: Accessor<boolean>;
};

export type MessageAuthorClass = (props: MessageAuthorProps) => Accessor<string | undefined>;

export type MessageHeaderProps = { id: string; kind: "channel" | "dm" };

export type MessageTakeover = {
  active: (view: MessageHeaderProps) => boolean;
  view: Component<MessageHeaderProps>;
};

export type ChannelMenuProps = {
  channelId: string;
  channelTitle: string;
  isDm: boolean;
  showMoveTo: boolean;
  close(): void;
};

declare module "../../shell/client/api/types" {
  interface PaneContents {
    thread: ThreadRef & { pinned?: boolean };
  }
}

declare module "@slock/core/types" {
  interface Points {
    "messages.blockKit": Partial<BlockKitResolver>;
    "messages.channelMenu": Component<ChannelMenuProps>;
    "messages.deleted": MessageDeletedHook;
    "messages.edited": Component<MessageEditedProps>;
    "messages.patch": MessagePatchHook;
    "messages.retain": (msg: Message) => boolean;
    "messages.header": Component<MessageHeaderProps>;
    "messages.takeover": MessageTakeover;
    "messages.headerLead": Component<MessageHeaderProps>;
    "messages.titleOpen": (view: MessageHeaderProps) => void;
    "messages.author": MessageAuthorClass;
    "messages.badge": Component<MessageBadgeProps>;
    "messages.footer": Component<MessageFooterProps>;
    "messages.body": Component<MessageBodyProps>;
    "messages.bar": Component<MessageBarProps>;
    "messages.menu": Component<MessageMenuProps>;
    "messages.quote": MessageQuote;
  }
  interface Services {
    messages: ReturnType<typeof createMessagesStore>;
  }
}
