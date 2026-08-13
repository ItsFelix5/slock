export type Nav = "home" | "activity" | "later" | "search";
export type View = { kind: "channel"; id: string } | { kind: "dm"; id: string };

export type ThreadRef = { channelId: string; ts: string; highlightTs?: string };

export type ChannelMessageTarget = { channelId: string; ts: string };

export type MessageLocation =
  | { store: "channel"; key: string }
  | { store: "thread"; key: string }
  | { store: "reaction"; key: string };
