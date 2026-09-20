import type { ActivityItem } from "./contentTypes";
import type {
  BrowsableChannel,
  CanvasListItem,
  Channel,
  ChannelDetails,
  DirectMessage,
  Message,
  SlackFile,
  SlackLink,
  User,
} from "./types";

export type FeedEntry = Omit<ActivityItem, "text"> & { text?: string };

export interface ActivityFeedPage {
  entries: FeedEntry[];
  nextCursor?: string;
}

export interface Bootstrap {
  activityCounts: Record<string, number> | undefined;
  allUsergroupIds: string[];
  channels: Channel[];
  currentUser: User;
  directMessages: DirectMessage[];
  lastReadByChannel: Record<string, number>;
  selfUsergroupIds: string[];
  starredChannelIds: string[];
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
  postingExceptionUserIds: string[];
  postingRestrictedToManagers: boolean;
  threadsRestrictedToManagers: boolean;
}

export type ChannelPostingPrefsPatch =
  | {
      posting: {
        exceptionUserIds: string[];
        restrictedToManagers: boolean;
      };
    }
  | { threadsRestrictedToManagers: boolean }
  | { allowChannelMentions: boolean };

export interface ConversationViewData {
  canvases: CanvasListItem[];
  channel: Channel;
  details: ChannelDetails;
  hasMore: boolean;
  messages: Message[];
  users: User[];
}

export type HistoryPage = {
  messages: Message[];
  hasMore: boolean;
  nextCursor?: string;
  view?: ConversationViewData;
};

export type NewerHistoryPage = {
  hasMore: boolean;
  messages: Message[];
  nextOldest?: string;
};

export interface FileUploadInput {
  file: File;
  title?: string;
}

export type DraftEntry = {
  channelId: string;
  threadTs?: string;
  text: string;
  blocks?: unknown;
  lastUpdatedTs?: string;
};

export interface PinnedMessage {
  message: Message | null;
  ts: string;
}

export interface SearchResult {
  botIcon?: string;
  botId?: string;
  botName?: string;
  channelId: string;
  channelName: string;
  highlights?: string[];
  text: string;
  threadTs?: string;
  ts: string;
  userId: string;
}

export type UserPrefs = {
  emojiUse: Record<string, number>;
  channelFrecency: Record<string, { count: number; lastVisit: number }>;
  mutedChannels: string[];
  notifyAllChannels: string[];
  channelNotifications: Record<string, { desktop?: string; mobile?: string }>;
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

export interface GlobalSearchResults {
  channels: BrowsableChannel[];
  files: SlackFile[];
  users: User[];
}

export type UserStatus = "eligible" | "over_18" | "banned" | "unverified";
