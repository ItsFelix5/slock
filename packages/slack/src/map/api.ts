import type { RawSavedItem, SavedItem } from "@slock/types";
import { parseChannelId, parseTs } from "../ids";

export function mapSavedItem(raw: RawSavedItem): SavedItem {
  return { ...raw, channelId: parseChannelId(raw.channelId), ts: parseTs(raw.ts) };
}
