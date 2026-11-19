import type { Block } from "../blocks/blocks";

export interface RawDraftEntry {
  blocks: Block[];
  channelId: string;
  clientMsgId: string;
  id: string;
  lastUpdatedTs?: string;
  threadTs?: string;
}

export interface RawSearchResult {
  blocks?: Block[];
  botIcon?: string;
  botId?: string;
  botName?: string;
  channelId: string;
  channelName: string;
  highlights?: string[];
  text: string;
  threadTs?: string;
  ts: string;
  userId: string;
}

export interface RawSavedItem {
  channelId: string;
  dateCreated?: number;
  dateDue?: number;
  ts: string;
}

export interface RawCanvasVersion {
  authorId: string;
  createdMs: number;
  sequence: number;
  versionId: string;
}
