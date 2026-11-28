import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createHost } from "@slock/core";
import { setHost, solidReactive } from "@slock/core/solid";
import type { User } from "@slock/types";
import { createRoot, flush } from "solid-js";
import { createTypingSlice } from "../../../../packages/plugins/src/typing/client/store";
import { createFakeEnv, type FakeEnv } from "../../../support/core";
import { ch, stamp, uid } from "../../../support/slack";

const C1 = ch("C1");
const ALICE = uid("UALICE");
const alice: User = { avatarColor: "#000", id: ALICE, name: "alice" };

let env: FakeEnv;
let host: ReturnType<typeof createHost>;

beforeEach(async () => {
  env = createFakeEnv();
  host = createHost({ env, reactive: solidReactive });
  setHost(host);
  await host.register();
});
afterEach(() => host.stop());

function mount() {
  return createRoot((dispose) => ({
    dispose,
    store: createTypingSlice({ userById: (id) => (id === ALICE ? alice : undefined) }),
  }));
}

describe("typing slice", () => {
  test("a typing user expires after the ttl", () => {
    const { store, dispose } = mount();
    store.recordTyping(C1, undefined, ALICE);
    flush();
    expect(store.typingUsersInChannel(C1)).toEqual([alice]);
    env.advance(5000);
    flush();
    expect(store.typingUsersInChannel(C1)).toEqual([]);
    dispose();
  });

  test("a thread has its own typing list", () => {
    const { store, dispose } = mount();
    const ts = stamp("1.000001");
    store.recordTyping(C1, ts, ALICE);
    flush();
    expect(store.typingUsersInChannel(C1)).toEqual([]);
    expect(store.typingUsersInThread(C1, ts)).toEqual([alice]);
    dispose();
  });

  test("posting clears the indicator", () => {
    const { store, dispose } = mount();
    store.recordTyping(C1, undefined, ALICE);
    flush();
    store.clearTyping(C1, undefined, ALICE);
    flush();
    expect(store.typingUsersInChannel(C1)).toEqual([]);
    dispose();
  });
});
