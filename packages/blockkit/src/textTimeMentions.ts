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

const DURATION_SPAN_RE = /^for\s/i;

const PERIOD_RESET_RE = /^this\s+(week|month|year)$/i;

function isNowReference(result: ParsedResult): boolean {
  return result.tags().has("casualReference/now");
}

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
