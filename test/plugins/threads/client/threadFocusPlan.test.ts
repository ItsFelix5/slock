import { describe, expect, test } from "bun:test";
import {
  planThreadFocus,
  type ThreadFocusInput,
} from "../../../../packages/plugins/src/threads/client/lib/threadFocusPlan";
import { message, slackTs } from "../../messages/client/messageFixture";

const root = slackTs(1_700_000_000);
const reply1 = slackTs(1_700_000_060);
const reply2 = slackTs(1_700_000_120);
const messages = [root, reply1, reply2].map((t) => message(t));

function input(patch: Partial<ThreadFocusInput> = {}): ThreadFocusInput {
  return {
    handledKey: undefined,
    highlightTs: undefined,
    loading: false,
    messages,
    remembered: undefined,
    repliesExhausted: false,
    ts: root,
    ...patch,
  };
}

describe("planThreadFocus", () => {
  test("an empty thread waits", () => {
    expect(planThreadFocus(input({ messages: [] }))).toEqual({ kind: "skip" });
  });

  test("lands on the first message by default", () => {
    const step = planThreadFocus(input());
    expect(step).toMatchObject({
      kind: "land",
      landing: { at: "first", ts: root },
      missingHighlight: false,
    });
  });

  test("a handled key is not landed twice, but a new highlight is", () => {
    const first = planThreadFocus(input());
    if (first.kind !== "land") throw new Error("expected a landing");
    expect(planThreadFocus(input({ handledKey: first.key }))).toEqual({ kind: "skip" });
    expect(planThreadFocus(input({ handledKey: first.key, highlightTs: reply1 })).kind).toBe(
      "land",
    );
  });

  test("a loaded highlight wins over a remembered position", () => {
    const step = planThreadFocus(
      input({ highlightTs: reply2, remembered: { offset: 4, ts: reply1 } }),
    );
    expect(step).toMatchObject({ landing: { at: "highlight", ts: reply2 } });
  });

  test("a remembered position restores only without a highlight and when still present", () => {
    const remembered = { offset: 12, ts: reply1 };
    expect(planThreadFocus(input({ remembered }))).toMatchObject({
      landing: { at: "remembered", offset: 12, ts: reply1 },
    });
    expect(
      planThreadFocus(input({ remembered: { offset: 1, ts: slackTs(1_800_000_000) } })),
    ).toMatchObject({ landing: { at: "first", ts: root } });
  });

  test("a missing highlight asks for replies unless a load is already running", () => {
    const missing = slackTs(1_700_000_999);
    expect(planThreadFocus(input({ highlightTs: missing }))).toEqual({ kind: "load-replies" });
    expect(planThreadFocus(input({ highlightTs: missing, loading: true }))).toEqual({
      kind: "skip",
    });
  });

  test("once replies are exhausted a missing highlight lands on the first message and is reported", () => {
    const step = planThreadFocus(
      input({
        highlightTs: slackTs(1_700_000_999),
        remembered: { offset: 1, ts: reply1 },
        repliesExhausted: true,
      }),
    );
    expect(step).toMatchObject({
      landing: { at: "first", ts: root },
      missingHighlight: true,
    });
  });
});
