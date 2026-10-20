import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RawMessage } from "@slock/types";

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const FIRST_TS = "0";
const LAST_TS = "9999999999.999999";

export type TsRange = { min?: string; max?: string };

type MessageRow = { message: string };
type BlobRow = { type: string; bytes: Uint8Array };

export type LogStore = ReturnType<typeof createLogStore>;

export function createLogStore(file: string) {
  mkdirSync(dirname(file), { recursive: true });
  const db = new Database(file, { strict: true });
  db.run("pragma journal_mode = wal");
  db.run(`create table if not exists deleted (
    workspace text not null,
    channel text not null,
    ts text not null,
    thread_ts text,
    top_level integer not null,
    deleted_at integer not null,
    message text not null,
    primary key (workspace, channel, ts)
  )`);
  db.run("drop table if exists blobs");
  db.run(`create table if not exists kept_files (
    owner text not null,
    url text not null,
    type text not null,
    bytes blob not null,
    stored_at integer not null,
    primary key (owner, url)
  )`);

  const insertMessage = db.prepare(
    "insert or ignore into deleted values ($workspace, $channel, $ts, $threadTs, $topLevel, $now, $message)",
  );
  const insertBlob = db.prepare(
    "insert or replace into kept_files values ($owner, $url, $type, $bytes, $now)",
  );
  const selectBlob = db.prepare<BlobRow, { owner: string; url: string }>(
    "select type, bytes from kept_files where owner = $owner and url = $url",
  );
  const hasBlob = db.prepare("select 1 from kept_files where owner = $owner and url = $url");
  const selectChannel = db.prepare<MessageRow, Record<string, string>>(
    `select message from deleted
     where workspace = $workspace and channel = $channel and top_level = 1
       and ts >= $min and ts <= $max
     order by ts`,
  );
  const selectThread = db.prepare<MessageRow, Record<string, string>>(
    `select message from deleted
     where workspace = $workspace and channel = $channel and thread_ts = $threadTs
       and ts >= $min and ts <= $max
     order by ts`,
  );
  const deleteOldMessages = db.prepare("delete from deleted where deleted_at < $cutoff");
  const deleteOldBlobs = db.prepare("delete from kept_files where stored_at < $cutoff");

  const parse = (rows: MessageRow[]): RawMessage[] => rows.map((row) => JSON.parse(row.message));
  const bounds = ({ min, max }: TsRange) => ({ max: max ?? LAST_TS, min: min ?? FIRST_TS });

  return {
    blob: (owner: string, url: string) => selectBlob.get({ owner, url }),
    hasBlob: (owner: string, url: string) => hasBlob.get({ owner, url }) !== null,
    channelMessages: (workspace: string, channel: string, range: TsRange) =>
      parse(selectChannel.all({ channel, workspace, ...bounds(range) })),
    close: () => db.close(),
    purge() {
      const cutoff = Date.now() - RETENTION_MS;
      deleteOldMessages.run({ cutoff });
      deleteOldBlobs.run({ cutoff });
    },
    saveBlob: (owner: string, url: string, type: string, bytes: Uint8Array) =>
      insertBlob.run({ bytes, now: Date.now(), owner, type, url }),
    saveMessage(workspace: string, channel: string, message: RawMessage) {
      const threadTs = message.thread_ts;
      const topLevel =
        !threadTs || threadTs === message.ts || message.subtype === "thread_broadcast";
      const { changes } = insertMessage.run({
        channel,
        message: JSON.stringify({ ...message, deleted: true }),
        now: Date.now(),
        threadTs: threadTs ?? null,
        topLevel: topLevel ? 1 : 0,
        ts: message.ts,
        workspace,
      });
      return changes > 0;
    },
    threadMessages: (workspace: string, channel: string, threadTs: string, range: TsRange) =>
      parse(
        selectThread.all({
          channel,
          threadTs,
          workspace,
          ...bounds(range),
        }),
      ),
  };
}
