import type { Attachment, Block } from "@slock/types";
import { createEffect, createMemo, createSignal } from "solid-js";
import { fetchLinkPreview } from "../../../slack/client/api";
import { previewableLinks } from "./blockLinks";

export interface LinkPreview {
  attachment: Attachment;
  url: string;
}

const SEND_WAIT_MS = 2000;

const sameUrls = (a: string[], b: string[]) =>
  a.length === b.length && a.every((u, i) => u === b[i]);

const lookupKey = (channelId: string, url: string) => `${channelId} ${url}`;

export function createLinkPreviews(opts: {
  blocks: () => Block[] | undefined;
  channelId: () => string | undefined;
  enabled: () => boolean;
}) {
  const [found, setFound] = createSignal<ReadonlyMap<string, Attachment>>(new Map());
  const [dismissed, setDismissed] = createSignal<ReadonlySet<string>>(new Set());
  const requested = new Set<string>();
  const inflight = new Set<Promise<void>>();

  const urls = createMemo(() => (opts.enabled() ? previewableLinks(opts.blocks()) : []), [], {
    equals: sameUrls,
  });

  const lookup = (channelId: string, url: string) => {
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

  createEffect(() => {
    const channelId = opts.channelId();
    if (channelId) for (const url of urls()) lookup(channelId, url);
  });

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
      await Promise.race([
        Promise.all(inflight),
        new Promise((resolve) => setTimeout(resolve, SEND_WAIT_MS)),
      ]);
      return previews().map((preview) => preview.url);
    },
  };
}
