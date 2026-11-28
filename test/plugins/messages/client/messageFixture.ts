import type { Message, Ts } from "@slock/types";
import { stamp, uid } from "../../../support/slack";

export function message(ts: Ts, overrides: Partial<Message> = {}): Message {
  return {
    day: "Today",
    id: ts,
    kind: "normal",
    text: `text ${ts}`,
    time: "10:00",
    ts,
    userId: uid("U1"),
    ...overrides,
  };
}

export function slackTs(seconds: number, micros = 0): Ts {
  return stamp(`${seconds}.${String(micros).padStart(6, "0")}`);
}
