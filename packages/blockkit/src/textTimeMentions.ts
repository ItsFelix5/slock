import { en, type ParsedComponents } from "chrono-node";
import { timeZoneOffsetAtAnchor, zonedDateTimeToMs } from "./dateFormat";

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

export function findTimeMentions(
  text: string,
  anchorMs: number,
  tz: string | undefined,
): TimeMention[] {
  const timezone = tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  return en.casual
    .parse(text, {
      instant: new Date(anchorMs),
      timezone: timeZoneOffsetAtAnchor(anchorMs, timezone),
    })
    .filter((result) => result.text.toLowerCase() !== "now")
    .map((result) => ({
      dateOnly: !result.start.isCertain("hour") && !result.start.isCertain("minute"),
      end: result.index + result.text.length,
      start: result.index,
      timestamp: timestampFor(result.start, timezone),
    }));
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
