import type { Block } from "../blocks/blocks";

export interface RawDraftEntry {
  blocks: Block[];
  channelId: string;
  clientMsgId: string;
  id: string;
  lastUpdatedTs?: string;
  threadTs?: string;
}

export interface RawSavedItem {
  channelId: string;
  dateCreated?: number;
  dateDue?: number;
  ts: string;
}
