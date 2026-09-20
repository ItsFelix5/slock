import { zonedWallTimeToMs } from "./dateFormat";

const TZ_OFFSET_MINUTES: Record<string, number> = {
  ACDT: 630,
  ACST: 570,
  AEDT: 660,
  AEST: 600,
  AFT: 270,
  AKDT: -480,
  AKST: -540,
  ART: -180,
  AWST: 480,
  BDT: 360,
  BRT: -180,
  BST: 60,
  CAT: 120,
  CDT: -300,
  CEST: 120,
  CHST: 600,
  CLT: -240,
  COT: -300,
  CST: -360,
  EAT: 180,
  EDT: -240,
  EEST: 180,
  EET: 120,
  EST: -300,
  FJT: 720,
  GMT: 0,
  GST: 240,
  HKT: 480,
  HST: -600,
  ICT: 420,
  IDT: 180,
  IRST: 210,
  IST: 330,
  JST: 540,
  KST: 540,
  MDT: -360,
  MMT: 390,
  MSK: 180,
  MST: -420,
  MYT: 480,
  NDT: -150,
  NPT: 345,
  NST: -210,
  NZDT: 780,
  NZST: 720,
  PDT: -420,
  PET: -300,
  PHT: 480,
  PKT: 300,
  PST: -480,
  SAST: 120,
  SGT: 480,
  TRT: 180,
  UTC: 0,
  VET: -240,
  WAT: 60,
  WEST: 60,
  WET: 0,
  WIB: 420,
};

const DST_AWARE_TZ_ZONE_NAMES: Record<string, string> = {
  AT: "America/Halifax",
  CET: "Europe/Paris",
  CT: "America/Chicago",
  ET: "America/New_York",
  MT: "America/Denver",
  PT: "America/Los_Angeles",
};

const TZ_ALTERNATION = [
  ...Object.keys(TZ_OFFSET_MINUTES),
  ...Object.keys(DST_AWARE_TZ_ZONE_NAMES),
].join("|");

const TIME_RE = new RegExp(
  `\\b(?:([01]?\\d|2[0-3]):([0-5]\\d)(?:\\s?([ap])\\.?m\\.?)?|([1-9]|1[0-2])(?::([0-5]\\d))?\\s?([ap])\\.?m\\.?)(?:\\s+(${TZ_ALTERNATION}))?\\b`,
  "gi",
);

function hour24(rawHour: string, ampm: string | undefined): number | undefined {
  const hour = Number(rawHour);
  if (!ampm) return hour;
  if (hour > 12) return;
  const isPm = ampm.toLowerCase() === "p";
  if (hour === 12) return isPm ? 12 : 0;
  return isPm ? hour + 12 : hour;
}

function msAtOffset(anchorMs: number, hour: number, minute: number, offsetMinutes: number): number {
  const shifted = new Date(anchorMs + offsetMinutes * 60_000);
  return (
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate(), hour, minute) -
    offsetMinutes * 60_000
  );
}

export interface TimeMention {
  end: number;
  start: number;
  timestamp: number;
}

export function findTimeMentions(
  text: string,
  anchorMs: number,
  senderTz: string | undefined,
): TimeMention[] {
  const mentions: TimeMention[] = [];
  for (const match of text.matchAll(TIME_RE)) {
    const [, h24, m24, ampm24, h12, m12, ampm12, tz] = match;
    const hour = hour24(h24 ?? h12, ampm24 ?? ampm12);
    if (hour === undefined) continue;
    const minute = Number(m24 ?? m12 ?? "0");
    const tzUpper = tz?.toUpperCase();
    const offsetMinutes = tzUpper ? TZ_OFFSET_MINUTES[tzUpper] : undefined;
    const zoneName = tzUpper ? DST_AWARE_TZ_ZONE_NAMES[tzUpper] : undefined;
    const timestamp =
      offsetMinutes === undefined
        ? zoneName
          ? zonedWallTimeToMs(anchorMs, hour, minute, zoneName)
          : senderTz
            ? zonedWallTimeToMs(anchorMs, hour, minute, senderTz)
            : undefined
        : msAtOffset(anchorMs, hour, minute, offsetMinutes);
    if (timestamp === undefined) continue;
    mentions.push({ end: match.index + match[0].length, start: match.index, timestamp });
  }
  return mentions;
}

export interface TextSegment {
  text: string;
  timestamp?: number;
}

export function splitTimeMentions(text: string, mentions: TimeMention[]): TextSegment[] {
  if (mentions.length === 0) return [{ text }];
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const m of mentions) {
    if (m.start > cursor) segments.push({ text: text.slice(cursor, m.start) });
    segments.push({ text: text.slice(m.start, m.end), timestamp: m.timestamp });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
