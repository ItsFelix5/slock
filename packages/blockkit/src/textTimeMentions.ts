// biome-ignore-all lint/performance/useTopLevelRegex: The global expressions are cloned by matchAll.
import { relativeDayMs, zonedWallTimeToMs } from "./dateFormat";

export interface TimeMention {
  // No specific time of day was given (e.g. "yesterday") — render the
  // tooltip as a bare date instead of a date + time.
  dateOnly?: boolean;
  end: number;
  start: number;
  timestamp: number;
}

const UNIT_MS: Record<string, number> = {
  d: 86_400_000,
  day: 86_400_000,
  h: 3_600_000,
  hour: 3_600_000,
  hr: 3_600_000,
  m: 60_000,
  min: 60_000,
  minute: 60_000,
  s: 1000,
  sec: 1000,
  second: 1000,
  w: 604_800_000,
  week: 604_800_000,
};

const DAY_OFFSETS: Record<string, number> = { today: 0, tomorrow: 1, yesterday: -1 };

// "ago" is a strong enough anchor that even single-letter shorthand ("5m ago",
// "2h ago") is safe to match. "in" alone is far too common a word, so that one
// requires a spelled-out-ish unit to cut false positives ("back in style").
const AGO_RE = /\b(\d{1,3})\s?(s|sec|second|m|min|minute|h|hr|hour|d|day|w|week)s?\s+ago\b/gi;
const IN_RE = /\bin\s+(\d{1,3})\s?(sec|second|min|minute|hr|hour|day|week)s?\b/gi;
// Checked before AMPM_CLOCK_RE below — "5pm UTC" must win over the shorter "5pm" read.
const AMPM_UTC_CLOCK_RE = /\b(1[0-2]|0?[1-9])(:[0-5]\d)?\s?(am|pm)\s?(UTC|GMT)\b/gi;
const AMPM_CLOCK_RE = /\b(1[0-2]|0?[1-9])(:[0-5]\d)?\s?(am|pm)\b/gi;
const UTC_CLOCK_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\s?(UTC|GMT)\b/g;
const DAY_WORD_RE = /\b(yesterday|today|tomorrow)\b/gi;

function findDurationMentions(
  text: string,
  re: RegExp,
  sign: 1 | -1,
  anchorMs: number,
): TimeMention[] {
  const out: TimeMention[] = [];
  for (const m of text.matchAll(re)) {
    const unitMs = UNIT_MS[m[2].toLowerCase()];
    const index = m.index ?? 0;
    out.push({
      end: index + m[0].length,
      start: index,
      timestamp: anchorMs + sign * Number(m[1]) * unitMs,
    });
  }
  return out;
}

function ampmToHour(digits: string, meridiem: string): number {
  return (Number(digits) % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0);
}

function findClockMentions(text: string, anchorMs: number, tz: string | undefined): TimeMention[] {
  const out: TimeMention[] = [];
  for (const m of text.matchAll(AMPM_UTC_CLOCK_RE)) {
    const index = m.index ?? 0;
    out.push({
      end: index + m[0].length,
      start: index,
      timestamp: zonedWallTimeToMs(
        anchorMs,
        ampmToHour(m[1], m[3]),
        m[2] ? Number(m[2].slice(1)) : 0,
        "UTC",
      ),
    });
  }
  for (const m of text.matchAll(AMPM_CLOCK_RE)) {
    const index = m.index ?? 0;
    out.push({
      end: index + m[0].length,
      start: index,
      // No explicit zone — read as the sender's own local time.
      timestamp: zonedWallTimeToMs(
        anchorMs,
        ampmToHour(m[1], m[3]),
        m[2] ? Number(m[2].slice(1)) : 0,
        tz,
      ),
    });
  }
  for (const m of text.matchAll(UTC_CLOCK_RE)) {
    const index = m.index ?? 0;
    out.push({
      end: index + m[0].length,
      start: index,
      timestamp: zonedWallTimeToMs(anchorMs, Number(m[1]), Number(m[2]), "UTC"),
    });
  }
  return out;
}

function findDayWordMentions(
  text: string,
  anchorMs: number,
  tz: string | undefined,
): TimeMention[] {
  const out: TimeMention[] = [];
  for (const m of text.matchAll(DAY_WORD_RE)) {
    const index = m.index ?? 0;
    out.push({
      dateOnly: true,
      end: index + m[0].length,
      start: index,
      timestamp: relativeDayMs(anchorMs, DAY_OFFSETS[m[1].toLowerCase()], tz),
    });
  }
  return out;
}

// Finds plain-text time references in a message (e.g. "3 seconds ago", "1pm",
// "5pm UTC", "yesterday") and resolves each to the real instant it refers to,
// anchored to when the message was sent and read in the sender's own
// timezone (falling back to the viewer's when unknown) unless the text names
// one explicitly (UTC/GMT). Overlapping matches keep whichever was found
// first, with ties broken toward the longer match — so "5pm UTC" wins over
// the "5pm" read nested inside it.
export function findTimeMentions(
  text: string,
  anchorMs: number,
  tz: string | undefined,
): TimeMention[] {
  const all = [
    ...findDurationMentions(text, AGO_RE, -1, anchorMs),
    ...findDurationMentions(text, IN_RE, 1, anchorMs),
    ...findClockMentions(text, anchorMs, tz),
    ...findDayWordMentions(text, anchorMs, tz),
  ].sort((a, b) => a.start - b.start || b.end - a.end);
  const out: TimeMention[] = [];
  let cursor = 0;
  for (const m of all) {
    if (m.start < cursor) continue;
    out.push(m);
    cursor = m.end;
  }
  return out;
}

export interface TextSegment {
  dateOnly?: boolean;
  text: string;
  timestamp?: number;
}

export function splitTimeMentions(text: string, mentions: TimeMention[]): TextSegment[] {
  if (mentions.length === 0) return [{ text }];
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const m of mentions) {
    if (m.start > cursor) segments.push({ text: text.slice(cursor, m.start) });
    segments.push({
      dateOnly: m.dateOnly,
      text: text.slice(m.start, m.end),
      timestamp: m.timestamp,
    });
    cursor = m.end;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}
