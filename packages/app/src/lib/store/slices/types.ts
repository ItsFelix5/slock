export type Nav = "home" | "activity" | "later" | "search";
export type View = { kind: "channel"; id: string } | { kind: "dm"; id: string };
export type ThreadRef = { channelId: string; ts: string };
// Where a given Message lives in the store, so actions (edit/delete/react) can
// patch the right list — a message can appear in a channel's history and/or a thread's
// replies.
export type MessageLocation = { store: "channel"; key: string } | { store: "thread"; key: string };
