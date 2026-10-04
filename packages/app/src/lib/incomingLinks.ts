import { createSignal } from "solid-js";
import { parseSlackPermalink, type SlackPermalinkTarget } from "./navigation/slackPermalink";

const [pendingShareText, setPendingShareText] = createSignal<string>();

export { pendingShareText };

export function clearPendingShare(): void {
  setPendingShareText(undefined);
}

function takeParams(...keys: string[]): (string | null)[] {
  const params = new URLSearchParams(location.search);
  const values = keys.map((key) => {
    const value = params.get(key);
    params.delete(key);
    return value;
  });
  if (values.some(Boolean)) {
    const rest = params.toString();
    history.replaceState(null, "", location.pathname + (rest ? `?${rest}` : ""));
  }
  return values;
}

export function consumeSharedProtocolLink(opener: {
  open: (target: SlackPermalinkTarget) => Promise<void>;
}): void {
  const [protocolUrl] = takeParams("url");
  if (!protocolUrl?.startsWith("web+slock:")) return;
  const target = parseSlackPermalink(`https:${protocolUrl.slice("web+slock:".length)}`);
  if (target) void opener.open(target);
}

export function consumeShareTarget(): void {
  const text = takeParams("share-title", "share-text", "share-url").filter(Boolean).join("\n");
  if (text) setPendingShareText(text);
}
