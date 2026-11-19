import { assertNever } from "@slock/core";
import { int, pick, type Random, text } from "@slock/core/testing";

type Kind =
  | "string"
  | "number"
  | "boolean"
  | "numbers"
  | "strings"
  | "record"
  | "channelId"
  | "fileId"
  | "ts"
  | "requiredTs"
  | "userId"
  | "userIds";
export type Spec = { [key: string]: Kind | { list: Spec } | { record: Spec } };

const WEIRD_STRINGS = ["", " ", "0", "-1", "1.5", "NaN", "<>&", "😀", "a.b.c", "__proto__"];

function garbageString(random: Random): string {
  return random() < 0.5 ? pick(random, WEIRD_STRINGS) : text(random, "ab:.-01 <>&😀", 8);
}

function garbageId(random: Random, prefix: string): string {
  return `${prefix}${text(random, "ABCDEF0123456789", 8)}1`;
}

function garbageTs(random: Random): string {
  return `${int(random, 1, 2_000_000_000)}.${text(random, "0123456789", 6)}0`;
}

function garbageLeaf(random: Random, kind: Kind): unknown {
  switch (kind) {
    case "string":
      return garbageString(random);
    case "number":
      return pick(random, [0, -1, 1.5, int(random, 0, 2_000_000_000), Number.MAX_SAFE_INTEGER]);
    case "boolean":
      return random() < 0.5;
    case "numbers":
      return Array.from({ length: int(random, 0, 3) }, () => int(random, -5, 100));
    case "strings":
      return Array.from({ length: int(random, 0, 3) }, () => garbageString(random));
    case "record":
      return {};
    case "channelId":
      return garbageId(random, pick(random, ["C", "G", "D"]));
    case "fileId":
      return garbageId(random, "F");
    case "userId":
      return garbageId(random, pick(random, ["U", "W", "B"]));
    case "userIds":
      return Array.from({ length: int(random, 0, 3) }, () => garbageId(random, "U"));
    case "requiredTs":
    case "ts":
      return garbageTs(random);
    default:
      return assertNever(kind);
  }
}

function garbageField(random: Random, kind: Spec[string]): unknown {
  if (typeof kind === "string") return garbageLeaf(random, kind);
  if ("list" in kind)
    return Array.from({ length: int(random, 0, 2) }, () => garbageRecord(random, kind.list));
  return garbageRecord(random, kind.record);
}

export function garbageRecord(random: Random, spec: Spec): Record<string, unknown> {
  const record: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(spec)) {
    if (kind === "fileId" || kind === "requiredTs") {
      record[key] = garbageField(random, kind);
      continue;
    }
    const roll = random();
    if (roll < 0.3) continue;
    record[key] = roll < 0.4 ? null : garbageField(random, kind);
  }
  return record;
}

export function viaJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value));
}

export const FILE_SPEC: Spec = {
  audio_wave_samples: "numbers",
  created: "number",
  duration_ms: "number",
  filetype: "string",
  id: "fileId",
  mimetype: "string",
  mode: "string",
  name: "string",
  original_h: "number",
  original_w: "number",
  size: "number",
  thumb_160: "string",
  thumb_360: "string",
  thumb_360_h: "number",
  thumb_360_w: "number",
  thumb_video: "string",
  transcription: { record: { lines: { list: { contents: "string", end_time_ms: "number" } } } },
  url_private: "string",
};

export const ATTACHMENT_SPEC: Spec = {
  actions: { list: { name: "string", text: "string", type: "string" } },
  files: { list: FILE_SPEC },
  image_url: "string",
  text: "string",
  ts: "ts",
};

export const MESSAGE_SPEC: Spec = {
  attachments: { list: ATTACHMENT_SPEC },
  bot_id: "userId",
  bot_profile: { record: { name: "string", icons: { record: { image_72: "string" } } } },
  files: { list: FILE_SPEC },
  icons: { record: { image_36: "string", image_72: "string" } },
  last_read: "ts",
  reply_count: "number",
  reply_users: "userIds",
  root: { record: { text: "string", ts: "requiredTs", user: "userId" } },
  subtype: "string",
  text: "string",
  thread_ts: "ts",
  type: "string",
  user: "userId",
  username: "string",
};

export const USER_SPEC: Spec = {
  color: "string",
  id: "userId",
  is_admin: "boolean",
  is_bot: "boolean",
  name: "string",
  presence: "string",
  profile: {
    record: {
      display_name: "string",
      fields: "record",
      image_48: "string",
      image_192: "string",
      real_name: "string",
      status_emoji: "string",
    },
  },
  real_name: "string",
  tz: "string",
  tz_label: "string",
  tz_offset: "number",
};
