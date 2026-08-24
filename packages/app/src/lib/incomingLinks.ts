import { createSignal } from "solid-js";
import { parseSlackPermalink, type SlackPermalinkTarget } from "./navigation/slackPermalink";

const PROTOCOL_SCHEME_RE = /^web\+slock:/;

const [pendingShareText, setPendingShareText] = createSignal<string>();

export { pendingShareText };

export function clearPendingShare(): void {
  setPendingShareText(undefined);
}

export interface IncomingLinkOpener {
  open: (target: SlackPermalinkTarget) => Promise<void>;
}

export function consumeSharedProtocolLink(opener: IncomingLinkOpener): void {
  const params = new URLSearchParams(location.search);
  const protocolUrl = params.get("url");
  if (!protocolUrl?.startsWith("web+slock:")) return;
  params.delete("url");
  history.replaceState(null, "", location.pathname + withQuery(params));
  const target = parseSlackPermalink(protocolUrl.replace(PROTOCOL_SCHEME_RE, "https:"));
  if (target) void opener.open(target);
}

export function consumeShareTarget(): void {
  const params = new URLSearchParams(location.search);
  const text = [params.get("share-title"), params.get("share-text"), params.get("share-url")]
    .filter(Boolean)
    .join("\n");
  if (!text) return;
  params.delete("share-title");
  params.delete("share-text");
  params.delete("share-url");
  history.replaceState(null, "", location.pathname + withQuery(params));
  setPendingShareText(text);
}

function withQuery(params: URLSearchParams): string {
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}
