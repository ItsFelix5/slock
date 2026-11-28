import type { ComposerNotice } from "@slock/plugins/messages/client/api/pane/ComposerGate";
import type { ChannelId, Message } from "@slock/types";
import type { JSX } from "@solidjs/web";

export interface ThreadOverride {
  action?(): { disabled: boolean; label: string; run(): void } | undefined;
  notice?(): ComposerNotice | undefined;
  subtitle(): JSX.Element;
  title: string;
}

declare module "@slock/core/types" {
  interface Points {
    "threads.override": (
      channelId: ChannelId,
      root: Message | undefined,
    ) => ThreadOverride | undefined;
  }
}
