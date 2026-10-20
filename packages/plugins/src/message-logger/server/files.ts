import {
  ASSET_PATH,
  rewriteSlackAssetUrls,
  slackAssetResponse,
} from "../../slack/server/api/assets";
import type { Credentials } from "../../slack/server/api/auth";
import type { LogStore } from "./store";
import { mapStrings } from "./strings";
import { ownerOf } from "./workspace";

const MAX_FILE_BYTES = 25 * 1024 * 1024;

async function keepAsset(url: string, creds: Credentials, store: LogStore) {
  const owner = ownerOf(creds);
  if (store.hasBlob(owner, url)) return;
  const res = await slackAssetResponse(url, creds, null, null);
  if (!res.ok || Number(res.headers.get("content-length")) > MAX_FILE_BYTES) return;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_FILE_BYTES) return;
  const type = res.headers.get("content-type") ?? "application/octet-stream";
  store.saveBlob(owner, url, type, bytes);
}

export async function keepAssets(message: unknown, creds: Credentials, store: LogStore) {
  const urls = new Set<string>();
  mapStrings(rewriteSlackAssetUrls(message, creds), (text) => {
    if (text.startsWith(`${ASSET_PATH}?`)) {
      const url = new URL(text, "http://local").searchParams.get("url");
      if (url) urls.add(url);
    }
    return text;
  });
  await Promise.all([...urls].map((url) => keepAsset(url, creds, store).catch(() => {})));
}
