import { sameItems, type TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import { defineQuery } from "@slock/plugins/query/client/api";
import { mapAttachment, replyError } from "@slock/slack";
import { apiPost } from "@slock/slack/client";
import type { Attachment, Block, ChannelId, RawAttachment } from "@slock/types";
import { createMemo, createSignal } from "solid-js";

import { previewableLinks } from "./blockLinks";

const env = service("env");

export interface LinkPreview {
  attachment: Attachment;
  url: string;
}

const SEND_WAIT_MS = 2000;

type Link = { channelId: ChannelId; url: string };

const unfurls = defineQuery<Link, Attachment | null>({
  load: async ({ channelId, url }, { signal }) => {
    const data = await apiPost<{ attachment?: RawAttachment }>(
      `/api/channels/${channelId}/unfurl`,
      { url },
      signal,
    );
    if (!data.ok) throw replyError(data, "chat.unfurlLink failed");
    return data.attachment ? mapAttachment(data.attachment) : null;
  },
  name: "linkPreviews",
  revalidates: false,
});

export function createLinkPreviews(opts: {
  blocks: () => Block[] | undefined;
  channelId: () => ChannelId | undefined;
  enabled: () => boolean;
}) {
  const [dismissed, setDismissed] = createSignal<ReadonlySet<string>>(new Set());

  const urls = createMemo(() => (opts.enabled() ? previewableLinks(opts.blocks()) : []), {
    equals: sameItems,
  });

  const wanted = (): Link[] => {
    const channelId = opts.channelId();
    if (!channelId) return [];
    return urls().flatMap((url) => (dismissed().has(url) ? [] : [{ channelId, url }]));
  };

  const collect = (lookup: (link: Link) => Attachment | null | undefined): LinkPreview[] =>
    wanted().flatMap((link) => {
      const attachment = lookup(link);
      return attachment ? [{ attachment, url: link.url }] : [];
    });

  const previews = createMemo(() => collect(unfurls.peek));

  return {
    dismiss: (url: string) => setDismissed((prev) => new Set(prev).add(url)),
    hasLinks: () => urls().length > 0,
    dismissAll: () => setDismissed((prev) => new Set([...prev, ...urls()])),
    previews,
    reset: () => setDismissed(new Set<string>()),
    async urlsToSend() {
      const loading = wanted()
        .filter((link) => unfurls.entry(link).status !== "error")
        .map((link) => unfurls.ensure(link));
      let timer: TimerHandle | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = env.setTimeout(resolve, SEND_WAIT_MS);
      });
      await Promise.race([Promise.allSettled(loading), timeout]);
      env.clearTimeout(timer);
      return collect(unfurls.read).map((preview) => preview.url);
    },
  };
}
