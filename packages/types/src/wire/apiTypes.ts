import type { Block } from "../blocks/blocks";
import type { ActivityItem } from "../contentTypes";
import type { Attachment, SlackFile, SlackLink } from "../fileTypes";
import type { ChannelId, TeamId, Ts, UserId } from "../ids";
import type { CanvasListItem, Channel, ChannelDetails, DirectMessage, Message } from "../types";
import type { User, UsergroupDetails } from "../userTypes";

export type FeedEntry = Omit<ActivityItem, "text"> & { text?: string };

export interface ActivityFeedPage {
  entries: FeedEntry[];
  nextCursor?: string;
}

export interface Bootstrap {
  activityCounts: Record<string, number> | undefined;
  allUsergroupIds: string[];
  channels: Channel[];
  countsLoaded: boolean;
  currentUser: User;
  directMessages: DirectMessage[];
  lastReadByChannel: Record<ChannelId, number>;
  selfUsergroupIds: string[];
  starredChannelIds: ChannelId[];
}

export interface ChannelFilesAndLinks {
  files: SlackFile[];
  filesTotal: number;
  hasMore: boolean;
  links: SlackLink[];
  linksTotal: number;
}

export interface ChannelPostingPrefs {
  allowChannelMentions: boolean;
  postingExceptionUserIds: UserId[];
  postingRestrictedToManagers: boolean;
  threadsRestrictedToManagers: boolean;
}

export type ChannelPostingPrefsPatch =
  | {
      posting: {
        exceptionUserIds: UserId[];
        restrictedToManagers: boolean;
      };
    }
  | { threadsRestrictedToManagers: boolean }
  | { allowChannelMentions: boolean };

export interface ConversationViewData {
  canvases: CanvasListItem[];
  channel: Channel;
  details: ChannelDetails;
  users: User[];
}

export type HistoryPage = {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
  pinCount?: number;
};

export interface FileUploadInput {
  file: File;
  title?: string;
}

export type DraftEntry = {
  id: string;
  clientMsgId: string;
  channelId: ChannelId;
  threadTs?: Ts;
  blocks: Block[];
  lastUpdatedTs?: Ts;
};

export interface PinnedMessage {
  message: Message | null;
  ts: Ts;
}

export interface SearchResult {
  attachments?: Attachment[];
  blocks?: Block[];
  botIcon?: string;
  botId?: string;
  botName?: string;
  botTeamId?: TeamId;
  channelId: ChannelId;
  channelName: string;
  files?: SlackFile[];
  highlights?: string[];
  text: string;
  threadTs?: Ts;
  ts: Ts;
  userId: UserId;
}

export type UserPrefs = {
  emojiUse: Record<string, number>;
  channelFrecency: Record<ChannelId, { count: number; lastVisit: number }>;
  mutedChannels: ChannelId[];
  notifyAllChannels: ChannelId[];
  channelNotifications: Record<ChannelId, { desktop?: string; mobile?: string }>;
  highlightWords: string[];
  sectionSort: Record<string, "recent">;
  sectionSidebar: Record<string, "hid" | "active" | "all">;
  sectionCollapsed: Record<string, boolean>;

  channelSections: Record<string, Record<string, unknown>>;
  globalNotifications: {
    desktop: string;
    desktopPushEnabled: boolean;
    keywords: string[];
    mobileSound?: string;
    mpdmDesktop: string;
    noTextInNotifications: boolean;
    pushIdleWait: number;
    pushShowPreview: boolean;
    threadsEverything: boolean;
  };
};

export interface SearchPage<Item> {
  items: Item[];
  page: number;
  pages: number;
  total: number;
}

export interface SearchHistoryEntry {
  hash: string;
  text: string;
}

export type UsergroupMatch = Pick<UsergroupDetails, "handle" | "id" | "memberCount" | "title">;

export type ApiFailure = { details?: unknown; error?: string; ok: false; retry_after?: string };
export type ApiReply<T extends object = object> = (T & { ok: true }) | ApiFailure;

export type AccountSummary = {
  id: string;
  name: string;
  domain: string;
  teamId: TeamId | null;
};

export type SessionInfo = { id: string | null; accounts: AccountSummary[] };
