import { fetchLinkPreview, type LinkPreview } from "@slock/slack-api";
import { createEffect, createMemo, createSignal } from "solid-js";
import { detectUrls } from "./textDetection";

// Detects bare URLs in the composer text, fetches (debounced) unfurl previews
// for them, and tracks which ones the user has dismissed — the composer-side
// half of link unfurling (the other half, rendering the fetched preview, is
// AttachmentCard via linkPreviewToAttachment).
export function createLinkPreviewController(text: () => string) {
  const [linkPreviews, setLinkPreviews] = createSignal<Record<string, LinkPreview | null>>({});
  const [dismissedLinks, setDismissedLinks] = createSignal<Set<string>>(new Set());
  let unfurlDebounce: ReturnType<typeof setTimeout> | undefined;

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

  // Debounced so a link half-typed character-by-character doesn't fire a
  // fetch per keystroke — only once the text settles down.
  createEffect(() => {
    const urls = detectedUrls();
    clearTimeout(unfurlDebounce);
    unfurlDebounce = setTimeout(() => {
      const dismissed = dismissedLinks();
      const cache = linkPreviews();
      for (const url of urls) {
        if (dismissed.has(url) || url in cache) continue;
        setLinkPreviews((prev) => ({ ...prev, [url]: null }));
        fetchLinkPreview(url).then((preview) => {
          setLinkPreviews((prev) => ({ ...prev, [url]: preview }));
        });
      }
    }, 500);
  });

  function dismissLinkPreview(url: string) {
    setDismissedLinks((prev) => new Set(prev).add(url));
  }

  function reset() {
    setLinkPreviews({});
    setDismissedLinks(new Set<string>());
  }

  function shouldSuppressUnfurl() {
    const dismissed = dismissedLinks();
    return detectedUrls().some((u) => dismissed.has(u));
  }

  return { detectedUrls, dismissLinkPreview, reset, shouldSuppressUnfurl, visiblePreviews };
}
