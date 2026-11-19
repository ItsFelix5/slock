import type { ChannelId, FileId, TeamId, Ts, UserId } from "@slock/types";
import { SlackError } from "./error";

const CHANNEL_ID = /^[CGD][A-Z0-9]+$/;
const FILE_ID = /^F[A-Z0-9]+$/;
const TEAM_ID = /^T[A-Z0-9]+$/;
const USER_ID = /^[UWB][A-Z0-9]+$/;
const TS = /^\d+(\.\d+)?$/;
const MICROS = 6;

export const isChannelId = (raw: string): raw is ChannelId => CHANNEL_ID.test(raw);
export const isFileId = (raw: string): raw is FileId => FILE_ID.test(raw);
export const isTeamId = (raw: string): raw is TeamId => TEAM_ID.test(raw);
export const isTs = (raw: string): raw is Ts => TS.test(raw);
export const isUserId = (raw: string): raw is UserId => USER_ID.test(raw);

function parser<T extends string>(label: string, guard: (raw: string) => raw is T) {
  return (raw: string): T => {
    if (guard(raw)) return raw;
    throw new SlackError({
      code: "invalid_wire_id",
      kind: "deterministic",
      message: `not a ${label}: ${JSON.stringify(raw)}`,
    });
  };
}

export const parseChannelId = parser("channel id", isChannelId);
export const parseFileId = parser("file id", isFileId);
export const parseTeamId = parser("team id", isTeamId);
export const parseTs = parser("ts", isTs);
export const parseUserId = parser("user id", isUserId);

export function ifPresent<T>(
  parse: (raw: string) => T,
  raw: string | null | undefined,
): T | undefined {
  return raw ? parse(raw) : undefined;
}

function micros(ts: Ts): bigint {
  const [seconds = "0", fraction = ""] = ts.split(".");
  return (
    BigInt(seconds) * 10n ** BigInt(MICROS) + BigInt(fraction.padEnd(MICROS, "0").slice(0, MICROS))
  );
}

export function compareTs(a: Ts, b: Ts): number {
  const diff = micros(a) - micros(b);
  return diff === 0n ? 0 : diff < 0n ? -1 : 1;
}

export function maxTs(first: Ts, ...rest: Ts[]): Ts {
  return rest.reduce((max, ts) => (compareTs(ts, max) > 0 ? ts : max), first);
}
