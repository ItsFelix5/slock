import type { BlockKitResolver } from "@slock/blockkit";
import type { PaneContentOf } from "@slock/plugins/shell/client/api/types";
import type { Attachment, ChannelId, Message, Ts, User, UserId } from "@slock/types";
import type { JSX } from "@solidjs/web";
import type { Accessor, Component } from "solid-js";
import type { createMessageFocusRegistry } from "./api/messageFocus";
import type { createScrollAnchors } from "./api/pane/scroll/rememberedAnchors";
import type { createMessagesStore } from "./store";

export type ThreadRef = { channelId: ChannelId; ts: Ts; highlightTs?: Ts };

export type ThreadPaneContent = PaneContentOf<"thread">;

export type MessageBadgeProps = {
  message: Message;
  channelId: ChannelId;
  threadTs?: Ts;
  showBroadcast: boolean;
};

export type MessageBodyProps = {
  msg: Message;
  channelId: ChannelId;
  threadTs?: Ts;
  isEditing: boolean;
  attachments?: Attachment[];
  onOpenThread?: (ts: Ts, options?: { pinned?: boolean }) => void;
};

export type MessageFooterProps = { channelId: ChannelId; threadTs?: Ts };

export type MessageMenuProps = {
  channelId: ChannelId;
  msg: Message;
  threadTs?: Ts;
  close(): void;
  edit(): void;
};

export type MessageBarProps = {
  channelId: ChannelId;
  msg: Message;
  threadTs?: Ts;
  onOpenThread?: (ts: Ts, options?: { pinned?: boolean }) => void;
  onReplyLink?: (msg: Message) => void;
  onEditRequest: () => void;
  rowFocused: () => boolean;
  reactionPickerTs: () => Ts | null;
  onToggleReactionPicker: (ts: Ts) => void;
};

type MessageDeletedHook = (channelId: ChannelId, ts: Ts) => void;

type MessagePatchHook = (current: Message, patch: Partial<Message>) => Partial<Message> | undefined;

export type MessageEditedProps = { msg: Message };

type MessageQuote = (msg: Message, channelId: ChannelId) => JSX.Element | undefined;

type MessageAuthorProps = {
  userId: Accessor<UserId | undefined>;
  user: Accessor<User | undefined>;
  visible: Accessor<boolean>;
};

export type MessageAuthorClass = (props: MessageAuthorProps) => Accessor<string | undefined>;

export type MessageHeaderProps = { id: ChannelId; kind: "channel" | "dm" };

type MessageTakeover = {
  active: (view: MessageHeaderProps) => boolean;
  view: Component<MessageHeaderProps>;
};

export type ChannelMenuProps = {
  channelId: ChannelId;
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
    "messages.loaded": (channelId: ChannelId, pinCount: number | undefined) => void;
    "messages.takeover": MessageTakeover;
    "messages.headerLead": Component<MessageHeaderProps>;
    "messages.titleIcon": Component<MessageHeaderProps>;
    "messages.intro": Component<MessageHeaderProps>;
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
    "messages.anchors": ReturnType<typeof createScrollAnchors>;
    "messages.focus": ReturnType<typeof createMessageFocusRegistry>;
  }
}
