import type {
  ChannelId,
  DirectMessage,
  SearchHistoryEntry,
  SearchResult,
  SlackFile,
  User,
  UsergroupMatch,
} from "@slock/types";

export type JumpRow =
  | { kind: "channel"; id: ChannelId; name: string; private: boolean }
  | { kind: "person"; id: string; user: User }
  | { kind: "dm"; id: ChannelId; dm: DirectMessage };

export type SearchRow =
  | JumpRow
  | { kind: "usergroup"; id: string; group: UsergroupMatch }
  | { kind: "file"; id: string; file: SlackFile }
  | { kind: "message"; id: string; message: SearchResult }
  | { kind: "history"; id: string; entry: SearchHistoryEntry }
  | { kind: "messages"; id: "messages"; query: string }
  | { kind: "more"; id: "more" }
  | { kind: "retry"; id: "retry" };

export type OpenableRow = Exclude<SearchRow, { kind: "history" | "messages" | "more" | "retry" }>;

export const rowKey = (row: SearchRow) => `${row.kind}:${row.id}`;

export const fileRow = (file: SlackFile): SearchRow => ({ file, id: file.id, kind: "file" });

export const messageRow = (message: SearchResult): SearchRow => ({
  id: `${message.channelId}:${message.ts}`,
  kind: "message",
  message,
});

export const personRow = (user: User): JumpRow => ({ id: user.id, kind: "person", user });

function sameFields(left: object, right: object): boolean {
  const values = Object.values(right);
  return Object.values(left).every((value, index) => value === values[index]);
}

export function reuseRows(previous: SearchRow[], next: SearchRow[]): SearchRow[] {
  const known = new Map(previous.map((row) => [rowKey(row), row]));
  return next.map((row) => {
    const old = known.get(rowKey(row));
    return old && sameFields(old, row) ? old : row;
  });
}
