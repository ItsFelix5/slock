import type { Channel, DirectMessage, Message, ModalView, User } from "../../../api";
import type { MessageLocation, ThreadRef, View } from "../types";

export type RealtimeDeps = {
  visibleViews: () => View[];
  visibleThreads: () => ThreadRef[];
  currentUser: () => User | undefined;
  channels: () => Channel[];
  isChannelMember: (id: string) => boolean;
  patchChannel: (id: string, patch: Partial<Channel>) => void;
  addJoinedChannel: (channel: Channel) => void;
  markChannelLeft: (channelId: string) => void;
  setUnreadChannelIds: (id: string, unread: boolean) => void;
  setLastReadByChannel: (id: string, ts: number) => void;
  setPresenceOverrides: (id: string, presence: "active" | "away") => void;
  invalidateUser: (id: string) => void;
  recordTyping: (channelId: string, threadTs: string | undefined, userId: string) => void;
  clearTyping: (channelId: string, threadTs: string | undefined, userId: string) => void;
  allDirectMessages: () => DirectMessage[];
  dmById: (id: string) => DirectMessage | undefined;
  closedDmIds: Record<string, boolean>;
  setClosedDmIds: (id: string, closed: boolean) => void;
  ensureDm: (channelId: string, userId: string) => void;
  ensureMpdm: (channelId: string) => void;
  patchDm: (id: string, patch: Partial<DirectMessage>) => void;
  openModalView: (view: ModalView) => void;
  updateModalView: (view: ModalView) => void;
  setGatewayActivityBadgeCounts: (activity: any) => boolean;
  refreshActivityFeed: () => void;
  applyPinEvent: (channelId: string, ts: string, pinned: boolean) => void;
  setChannelStarred: (channelId: string, starred: boolean) => void;
  applySavedEvent: (action: "add" | "remove" | "clear", channelId?: string, ts?: string) => void;
  invalidateUsergroup: (id: string) => void;
  handleCanvasCreated: (channelId: string) => void;
  applyDndSnoozeEvent: (snoozedUntil: number | null) => void;
  applyThreadMarked: (threadTs: string, unreadCount: number) => void;
  showGatewayNotification: (payload: any) => void;
  messagesByChannel: Record<string, Message[]>;
  setMessagesByChannel: (channelId: string, updater: (existing?: Message[]) => Message[]) => void;
  threadMessages: Record<string, Message[]>;
  setThreadMessages: (threadTs: string, updater: (existing?: Message[]) => Message[]) => void;
  loadedChannels: Set<string>;
  loadRecentHistory: (channelId: string) => Promise<void>;
  refreshThreadReplies: (ts: string) => Promise<Message[] | undefined>;
  isThreadKnown: (ts: string) => boolean;
  findAllMessageLocations: (
    channelId: string,
    ts: string,
  ) => { location: MessageLocation; list: Message[] }[];
  patchMessage: (channelId: string, ts: string, patch: Partial<Message>) => void;
  insertMessageInOrder: (channelId: string, msg: Message) => void;
  mergeIncomingMessage: (existing: Message[], msg: Message) => Message[];
  applyReactionEvent: (
    channel: string,
    ts: string,
    name: string,
    userId: string,
    added: boolean,
    itemUserId?: string,
  ) => void;
};
