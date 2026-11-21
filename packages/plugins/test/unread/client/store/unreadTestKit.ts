import { ch, stamp, uid } from "@slock/slack/testing";
import type { Channel, DirectMessage, Message } from "@slock/types";
import { createRoot, createSignal, flush as flushSolid } from "solid-js";
import { createUnreadStore } from "../../../../src/unread/client/store";

export type Bootstrap = {
  channels: Channel[];
  countsLoaded?: boolean;
  directMessages: DirectMessage[];
  lastReadByChannel: Record<string, number>;
};

export const C1 = ch("C1");

const brandedLastRead = (raw: Record<string, number>) =>
  Object.fromEntries(Object.entries(raw).map(([id, ms]) => [ch(id), ms]));

export const dm = (id: string, unread = false): DirectMessage => ({ id: ch(id), unread });

export const channel = (id: string, unread = false): Channel => ({
  archived: false,
  id: ch(id),
  name: id,
  private: false,
  topic: "",
  unread,
});

export const message = (ts: string, extra: Partial<Message> = {}): Message => ({
  day: "",
  id: stamp(ts),
  kind: "normal",
  text: ts,
  time: "",
  ts: stamp(ts),
  userId: uid("U1"),
  ...extra,
});

export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

const disposers: (() => void)[] = [];

export function mount<T>(build: () => T): T {
  const result = createRoot((dispose) => {
    disposers.push(dispose);
    return build();
  });
  flushSolid();
  return result;
}

export function unmountAll() {
  for (const dispose of disposers.splice(0)) dispose();
}

export function harness(initial?: Bootstrap) {
  const channelReads: [string, string][] = [];
  const threadReads: [string, string, string][] = [];
  const flashes: string[] = [];
  let countRefreshes = 0;
  const patches: [string, object][] = [];
  const failure: { error?: Error } = {};
  const [bootstrap, setBootstrap] = createSignal(initial);
  const loaded = () => {
    const data = bootstrap();
    return (
      data && {
        ...data,
        countsLoaded: data.countsLoaded ?? true,
        lastReadByChannel: brandedLastRead(data.lastReadByChannel),
      }
    );
  };
  const settle = () => (failure.error ? Promise.reject(failure.error) : Promise.resolve());
  const store = createUnreadStore({
    api: {
      markChannelRead: (channelId, ts) => {
        channelReads.push([channelId, ts]);
        return settle();
      },
      markThreadRead: (channelId, threadTs, ts) => {
        threadReads.push([channelId, threadTs, ts]);
        return settle();
      },
    },
    bootstrap: loaded,
    flash: (_key, text) => flashes.push(text),
    onReadSynced: () => countRefreshes++,
    patchChannel: (id, patch) => patches.push([id, patch]),
    patchDm: (id, patch) => patches.push([id, patch]),
  });
  return {
    channelReads,
    countRefreshes: () => countRefreshes,
    failure,
    flashes,
    patches,
    setBootstrap,
    store,
    threadReads,
  };
}

function replace<T extends object, K extends keyof T>(target: T, key: K, value: T[K]) {
  const original = target[key];
  target[key] = value;
  return () => {
    target[key] = original;
  };
}

export function fakeWindow() {
  const handlers = new Map<string, Set<unknown>>();
  let focused = true;
  const track = (target: EventTarget) => [
    replace(target, "addEventListener", (type: string, handler: unknown) => {
      handlers.set(type, (handlers.get(type) ?? new Set()).add(handler));
    }),
    replace(target, "removeEventListener", (type: string, handler: unknown) => {
      handlers.get(type)?.delete(handler);
    }),
  ];
  const restores = [
    ...track(window),
    ...track(document),
    replace(document, "hasFocus", () => focused),
  ];
  const fire = (type: string) => {
    for (const handler of [...(handlers.get(type) ?? [])]) (handler as () => void)();
  };
  return {
    listenerCount: () => [...handlers.values()].reduce((total, set) => total + set.size, 0),
    restore: () => {
      for (const restore of restores) restore();
    },
    setFocused(value: boolean) {
      focused = value;
      fire(value ? "focus" : "blur");
    },
  };
}
