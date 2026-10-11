import type { JSX } from "solid-js";

export type ThreadHeader = (
  channelId: string,
) => { title: string; subtitle(): JSX.Element } | undefined;

declare module "@slock/core/types" {
  interface Points {
    "threads.header": ThreadHeader;
  }
}
