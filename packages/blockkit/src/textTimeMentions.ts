import { en, type ParsedComponents, type ParsedResult } from "chrono-node";
import { partsInZone, timeZoneOffsetAtAnchor, zonedDateTimeToMs } from "./dateFormat";

export interface TimeMention {
  dateOnly?: boolean;
  end: number;
  start: number;
  timestamp: number;
}

function component(
  components: ParsedComponents,
  name: "year" | "month" | "day" | "hour" | "minute" | "second",
) {
  return components.get(name) ?? 0;
}

function timestampFor(components: ParsedComponents, timeZone: string | undefined): number {
  if (components.isCertain("timezoneOffset")) return components.date().getTime();
  return zonedDateTimeToMs(
    component(components, "year"),
    component(components, "month"),
    component(components, "day"),
    component(components, "hour"),
    component(components, "minute"),
    component(components, "second"),
    timeZone,
  );
}

// "for a year"/"for 2 weeks" parse to a point in time, but the phrase names a
// span rather than a deadline - chrono's own within/for/in duration parser
// (ENTimeUnitWithinFormatParser) treats all three prepositions the same, so
// "for" is the only textual signal left that distinguishes a span from a point.
const DURATION_SPAN_RE = /^for\s/i;

// bare "this week"/"this month"/"this year" (no "next"/"last" modifier) hit a
// chrono quirk (ENRelativeDateFormatParser) that resets the date to the start
// of that period - Aug 13 becomes "this month" -> Aug 1, "this year" -> Jan 1
// - instead of keeping the anchor's actual day. That's not a rough guess,
// it's a wrong date, so there's nothing sensible to show a tooltip for.
const PERIOD_RESET_RE = /^this\s+(week|month|year)$/i;

// a specific clock time (e.g. "5pm") is worth a tooltip even if it happens to
// land on the exact instant the message was sent - the value is translating
// it into the reader's own timezone, which is never redundant with anything
// already on screen. "now" is the one exception: it doesn't name a point that
// needs translating, it just means "whenever this was sent", which the
// message's own timestamp already shows. Match chrono's own tag for that
// instead of the literal word, so "right now"/"just now" are caught too.
function isNowReference(result: ParsedResult): boolean {
  return result.tags().has("casualReference/now");
}

// a dateOnly mention (no specific hour) only shows a bare date in the
// tooltip. If that date is the same day the reader already sees the message
// on, it adds nothing - "this morning" said about today is not news. This
// has to compare in the reader's own timezone (this code runs on the
// reader's device): a message sent late at night in the sender's zone can
// land on a different calendar day once converted for the reader, in which
// case the date genuinely is new information.
function isRedundantSameDay(timestamp: number, anchorMs: number, readerTimezone: string): boolean {
  const anchorDay = partsInZone(anchorMs, readerTimezone);
  const resultDay = partsInZone(timestamp, readerTimezone);
  return (
    anchorDay.year === resultDay.year &&
    anchorDay.month === resultDay.month &&
    anchorDay.day === resultDay.day
  );
}

function isMeaningfulMention(
  result: ParsedResult,
  dateOnly: boolean,
  timestamp: number,
  anchorMs: number,
  readerTimezone: string,
): boolean {
  if (DURATION_SPAN_RE.test(result.text)) return false;
  if (PERIOD_RESET_RE.test(result.text)) return false;
  if (isNowReference(result)) return false;
  if (dateOnly) return !isRedundantSameDay(timestamp, anchorMs, readerTimezone);
  return true;
}

export function findTimeMentions(
  text: string,
  anchorMs: number,
  tz: string | undefined,
): TimeMention[] {
  const readerTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // the phrase is interpreted in the sender's timezone (falling back to the
  // reader's when unknown) - "this morning" means the sender's morning
  const timezone = tz ?? readerTimezone;
  const mentions: TimeMention[] = [];
  for (const result of en.casual.parse(text, {
    instant: new Date(anchorMs),
    timezone: timeZoneOffsetAtAnchor(anchorMs, timezone),
  })) {
    const dateOnly = !(result.start.isCertain("hour") || result.start.isCertain("minute"));
    const timestamp = timestampFor(result.start, timezone);
    if (!isMeaningfulMention(result, dateOnly, timestamp, anchorMs, readerTimezone)) continue;
    mentions.push({
      dateOnly,
      end: result.index + result.text.length,
      start: result.index,
      timestamp,
    });
  }
  return mentions;
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
