import type { Env } from "./types";

export const systemEnv: Env = {
  clearInterval: (handle) => handle?.cancel(),
  clearTimeout: (handle) => handle?.cancel(),
  fetch: (input, init) => globalThis.fetch(input, init),
  now: () => Date.now(),
  random: () => Math.random(),
  setInterval: (callback, ms) => {
    const id = globalThis.setInterval(callback, ms);
    return { cancel: () => globalThis.clearInterval(id) };
  },
  setTimeout: (callback, ms) => {
    const id = globalThis.setTimeout(callback, ms);
    return { cancel: () => globalThis.clearTimeout(id) };
  },
  storage: {
    get: () => null,
    remove: () => {},
    set: () => {},
    subscribe: () => () => {},
  },
};
