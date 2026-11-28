import type { Message, Ts } from "@slock/types";

export interface ThreadFocusInput {
  handledKey: string | undefined;
  highlightTs: Ts | undefined;
  loading: boolean;
  messages: Message[];
  remembered: { offset: number; ts: Ts } | undefined;
  repliesExhausted: boolean;
  ts: Ts;
}

type ThreadLanding =
  | { at: "first"; ts: Ts }
  | { at: "highlight"; ts: Ts }
  | { at: "remembered"; offset: number; ts: Ts };

type ThreadFocusStep =
  | { kind: "skip" }
  | { kind: "load-replies" }
  | { kind: "land"; key: string; landing: ThreadLanding; missingHighlight: boolean };

const SKIP: ThreadFocusStep = { kind: "skip" };

const threadFocusKey = (ts: Ts, highlightTs: Ts | undefined) => `${ts}:${highlightTs ?? ""}`;

export function planThreadFocus(input: ThreadFocusInput): ThreadFocusStep {
  const key = threadFocusKey(input.ts, input.highlightTs);
  const [first] = input.messages;
  if (input.handledKey === key || !first) return SKIP;
  const { highlightTs, messages } = input;
  const found = highlightTs !== undefined && messages.some((m) => m.ts === highlightTs);
  const missingHighlight = highlightTs !== undefined && !found;
  if (missingHighlight && !input.repliesExhausted)
    return input.loading ? SKIP : { kind: "load-replies" };
  const { remembered } = input;
  const landing: ThreadLanding =
    found && highlightTs
      ? { at: "highlight", ts: highlightTs }
      : !highlightTs && remembered && messages.some((m) => m.ts === remembered.ts)
        ? { at: "remembered", offset: remembered.offset, ts: remembered.ts }
        : { at: "first", ts: first.ts };
  return { kind: "land", key, landing, missingHighlight };
}
