export type Nav = "home" | "activity" | "later" | "search";
export type View = { kind: "channel"; id: string } | { kind: "dm"; id: string };

export type ThreadRef = { channelId: string; ts: string; highlightTs?: string };

export type ChannelMessageTarget = { channelId: string; ts: string };

export type ChannelDetailsTab = "about" | "members" | "settings";

export type ThreadPaneContent = ThreadRef & { kind: "thread"; pinned?: boolean };
export type ProfilePaneContent = { kind: "profile"; userId: string };
export type ChannelDetailsPaneContent = {
  kind: "channel-details";
  channelId: string;
  tab?: ChannelDetailsTab;
};
export type UsergroupDetailsPaneContent = { kind: "usergroup-details"; usergroupId: string };
export type PinnedPaneContent = { kind: "pinned"; channelId: string };

export type PaneContent =
  | View
  | ThreadPaneContent
  | ProfilePaneContent
  | ChannelDetailsPaneContent
  | UsergroupDetailsPaneContent
  | PinnedPaneContent;

export type MessageLocation =
  | { store: "channel"; key: string }
  | { store: "thread"; key: string }
  | { store: "reaction"; key: string };
