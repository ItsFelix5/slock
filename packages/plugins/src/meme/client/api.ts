import type { ChannelId, Ts } from "@slock/types";
import type { createMemeStore } from "./store";

export type MemeSource = {
  name: string;
  urls: string[];
};

export type MemeTarget = {
  channelId: ChannelId;
  source: MemeSource;
  threadTs?: Ts;
};

declare module "@slock/core/types" {
  interface Services {
    meme: ReturnType<typeof createMemeStore>;
  }
}
