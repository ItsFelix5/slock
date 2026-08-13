import { fetchLinkPreview, type LinkPreview } from "@slock/slack-api";
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js";
import { detectUrls } from "./textDetection";

export interface LinkPreviewControllerOptions {
  debounceMs?: number;
  fetchPreview?: (url: string) => Promise<LinkPreview | null>;
}

type LinkPreviewCache = Record<string, LinkPreview | null>;

export async function settleLinkPreview(
  url: string,
  fetchPreview: (url: string) => Promise<LinkPreview | null>,
  isCurrent: () => boolean,
  update: (updater: (cache: LinkPreviewCache) => LinkPreviewCache) => void,
) {
  try {
    const preview = await fetchPreview(url);
    if (isCurrent()) update((cache) => ({ ...cache, [url]: preview }));
  } catch {
    if (!isCurrent()) return;

    update((cache) => {
      if (!(url in cache)) return cache;
      const next = { ...cache };
      delete next[url];
      return next;
    });
  }
}

export function createLinkPreviewController(
  text: () => string,
  options: LinkPreviewControllerOptions = {},
) {
  const [linkPreviews, setLinkPreviews] = createSignal<LinkPreviewCache>({});
  const [dismissedLinks, setDismissedLinks] = createSignal<Set<string>>(new Set());
  let unfurlDebounce: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  let resetVersion = 0;

  const detectedUrls = createMemo(() => detectUrls(text()));

  const visiblePreviews = createMemo(() => {
    const dismissed = dismissedLinks();
    const cache = linkPreviews();
    const result: LinkPreview[] = [];
    for (const url of detectedUrls()) {
      if (dismissed.has(url)) continue;
      const preview = cache[url];
      if (preview) result.push(preview);
    }
    return result;
  });

  createEffect(() => {
    const urls = detectedUrls();
    clearTimeout(unfurlDebounce);
    unfurlDebounce = setTimeout(() => {
      const requestVersion = resetVersion;
      const dismissed = dismissedLinks();
      const cache = linkPreviews();
      for (const url of urls) {
        if (dismissed.has(url) || url in cache) continue;
        setLinkPreviews((prev) => ({ ...prev, [url]: null }));
        void settleLinkPreview(
          url,
          options.fetchPreview ?? fetchLinkPreview,
          () => active && requestVersion === resetVersion,
          setLinkPreviews,
        );
      }
    }, options.debounceMs ?? 500);
  });

  onCleanup(() => {
    active = false;
    clearTimeout(unfurlDebounce);
  });

  function dismissLinkPreview(url: string) {
    setDismissedLinks((prev) => new Set(prev).add(url));
  }

  function reset() {
    resetVersion++;
    setLinkPreviews({});
    setDismissedLinks(new Set<string>());
  }

  function shouldSuppressUnfurl() {
    const dismissed = dismissedLinks();
    return detectedUrls().some((u) => dismissed.has(u));
  }

  return {
    detectedUrls,
    dismissLinkPreview,
    reset,
    shouldSuppressUnfurl,
    visiblePreviews,
  };
}
