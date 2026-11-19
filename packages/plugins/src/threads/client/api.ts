import type { JSX } from "@solidjs/web";

export type ThreadHeader = (
  channelId: string,
) => { title: string; subtitle(): JSX.Element } | undefined;

declare module "@slock/core/types" {
  interface Points {
    "threads.header": ThreadHeader;
  }
}
