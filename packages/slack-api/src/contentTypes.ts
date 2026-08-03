export interface ActivityItem {
  broadcastRange?: "channel" | "here" | "everyone";
  channelId: string;
  id: string;
  kind:
    | "mention"
    | "reaction"
    | "dm"
    | "thread_reply"
    | "channel_mention"
    | "usergroup_mention"
    | "channel_all"
    | "keyword"
    | "reminder"
    | "channel_invite";
  // The pingword that matched, for kind "keyword" — surfaced from
  // all_notifications_prefs.global.global_keywords.
  matchedKeyword?: string;
  reactionName?: string;
  text: string;
  // Root ts of the thread this happened in, when different from `ts` (e.g. a
  // thread_reply's own message ts vs. the parent it replied to).
  threadTs?: string;
  time: number;
  ts: string;
  // For kind "thread_reply": Slack bundles every unread reply since your last
  // visit into a single feed entry, only ever exposing the latest one's ts —
  // this is bundle_info's own count of how many replies that single entry
  // actually represents, so callers can go fetch the rest.
  unreadCount?: number;
  usergroupId?: string;
  userId: string;
}

export interface SavedItem {
  channelId: string;
  ts: string;
}

// A client-side stand-in for a Slack unfurl, shown in the composer before
// send — see fetchLinkPreview.
export interface LinkPreview {
  description?: string;
  imageUrl?: string;
  siteName?: string;
  title?: string;
  url: string;
}
