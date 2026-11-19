import type {
  CanvasVersion,
  DraftEntry,
  RawCanvasVersion,
  RawDraftEntry,
  RawSavedItem,
  RawSearchResult,
  SavedItem,
  SearchResult,
} from "@slock/types";
import { ifPresent, parseChannelId, parseTs, parseUserId } from "../ids";

export function mapDraft(raw: RawDraftEntry): DraftEntry {
  return {
    blocks: raw.blocks,
    channelId: parseChannelId(raw.channelId),
    clientMsgId: raw.clientMsgId,
    id: raw.id,
    lastUpdatedTs: ifPresent(parseTs, raw.lastUpdatedTs),
    threadTs: ifPresent(parseTs, raw.threadTs),
  };
}

export function mapSearchResult(raw: RawSearchResult): SearchResult {
  return {
    ...raw,
    channelId: parseChannelId(raw.channelId),
    threadTs: ifPresent(parseTs, raw.threadTs),
    ts: parseTs(raw.ts),
    userId: parseUserId(raw.userId),
  };
}

export function mapSavedItem(raw: RawSavedItem): SavedItem {
  return { ...raw, channelId: parseChannelId(raw.channelId), ts: parseTs(raw.ts) };
}

export function mapCanvasVersion(raw: RawCanvasVersion): CanvasVersion {
  return { ...raw, authorId: parseUserId(raw.authorId) };
}
