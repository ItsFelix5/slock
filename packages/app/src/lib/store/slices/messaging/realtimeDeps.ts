import type { Channel, DirectMessage, Message, ModalView, User } from "../../../api";
import type { MessageLocation, ThreadRef, View } from "../types";

export type RealtimeDeps = {
  visibleViews: () => View[];
  visibleThreads: () => ThreadRef[];
  currentUser: () => User | undefined;
  channels: () => Channel[];
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
  closedDmIds: Record<string, boolean>;
  setClosedDmIds: (id: string, closed: boolean) => void;
  ensureDm: (channelId: string, userId: string) => void;
  patchDm: (id: string, patch: Partial<DirectMessage>) => void;
  openModalView: (view: ModalView) => void;
  setGatewayActivityBadgeCounts: (activity: any) => boolean;
  refreshActivityFeed: () => void;
  messagesByChannel: Record<string, Message[]>;
  setMessagesByChannel: (channelId: string, updater: (existing?: Message[]) => Message[]) => void;
  threadMessages: Record<string, Message[]>;
  setThreadMessages: (threadTs: string, updater: (existing?: Message[]) => Message[]) => void;
  loadedChannels: Set<string>;
  loadedThreads: Set<string>;
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
