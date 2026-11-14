import type { Message } from "@slock/types";

export function message(ts: string, overrides: Partial<Message> = {}): Message {
  return {
    day: "Today",
    id: ts,
    kind: "normal",
    text: `text ${ts}`,
    time: "10:00",
    ts,
    userId: "U1",
    ...overrides,
  };
}

export function slackTs(seconds: number, micros = 0): string {
  return `${seconds}.${String(micros).padStart(6, "0")}`;
}
