import { sameItems, type TimerHandle } from "@slock/core";
import { service } from "@slock/core/solid";
import type { Attachment, Block, ChannelId } from "@slock/types";
import { createEffect, createMemo, createSignal } from "solid-js";
import { fetchLinkPreview } from "../../../slack/client/api";
import { previewableLinks } from "./blockLinks";

const env = service("env");

export interface LinkPreview {
  attachment: Attachment;
  url: string;
}

const SEND_WAIT_MS = 2000;

const lookupKey = (channelId: ChannelId, url: string) => `${channelId} ${url}`;

export function createLinkPreviews(opts: {
  blocks: () => Block[] | undefined;
  channelId: () => ChannelId | undefined;
  enabled: () => boolean;
}) {
  const [found, setFound] = createSignal<ReadonlyMap<string, Attachment>>(new Map());
  const [dismissed, setDismissed] = createSignal<ReadonlySet<string>>(new Set());
  const requested = new Set<string>();
  const inflight = new Set<Promise<void>>();

  const urls = createMemo(() => (opts.enabled() ? previewableLinks(opts.blocks()) : []), {
    equals: sameItems,
  });

  const lookup = (channelId: ChannelId, url: string) => {
    const key = lookupKey(channelId, url);
    if (requested.has(key)) return;
    requested.add(key);
    const request: Promise<void> = fetchLinkPreview(channelId, url)
      .then(
        (attachment) => {
          if (attachment) setFound((prev) => new Map(prev).set(key, attachment));
        },
        () => {
          requested.delete(key);
        },
      )
      .finally(() => inflight.delete(request));
    inflight.add(request);
  };

  createEffect(
    () => ({ channelId: opts.channelId(), urls: urls() }),
    ({ channelId, urls: wanted }) => {
      if (channelId) for (const url of wanted) lookup(channelId, url);
    },
  );

  const previews = createMemo<LinkPreview[]>(() => {
    const channelId = opts.channelId();
    if (!channelId) return [];
    return urls().flatMap((url) => {
      const attachment = found().get(lookupKey(channelId, url));
      return attachment && !dismissed().has(url) ? [{ attachment, url }] : [];
    });
  });

  return {
    dismiss: (url: string) => setDismissed((prev) => new Set(prev).add(url)),
    dismissAll: () => setDismissed((prev) => new Set([...prev, ...urls()])),
    previews,
    reset: () => setDismissed(new Set<string>()),
    async urlsToSend() {
      let timer: TimerHandle | undefined;
      const timeout = new Promise<void>((resolve) => {
        timer = env.setTimeout(resolve, SEND_WAIT_MS);
      });
      await Promise.race([Promise.all(inflight), timeout]);
      env.clearTimeout(timer);
      return previews().map((preview) => preview.url);
    },
  };
}
