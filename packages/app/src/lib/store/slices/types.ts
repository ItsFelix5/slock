export type Nav = "home" | "activity" | "later" | "search";
export type View = { kind: "channel"; id: string } | { kind: "dm"; id: string };
// highlightTs: when opening a thread by a specific reply rather than its
// root (e.g. from Later/Activity), scroll to and flash that reply once loaded.
export type ThreadRef = { channelId: string; ts: string; highlightTs?: string };
// A transient request to reveal a message in the main channel timeline. The
// object identity distinguishes repeated clicks on the same message, just as a
// fresh ThreadRef does for repeated thread navigation.
export type ChannelMessageTarget = { channelId: string; ts: string };
// Where a given Message lives in the store, so actions (edit/delete/react) can
// patch the right list — a message can appear in a channel's history and/or a thread's
// replies.
export type MessageLocation = { store: "channel"; key: string } | { store: "thread"; key: string };
